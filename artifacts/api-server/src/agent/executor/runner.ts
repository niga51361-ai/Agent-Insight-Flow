import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  agentTasksTable,
  agentStepsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ToolRegistry } from "../tools/registry.js";
import type { MemoryManager } from "../memory/manager.js";
import { runCritic } from "../critic/critic.js";
import { logger } from "../../lib/logger.js";

let _openaiInstance: OpenAI | null = null;
  function getOpenAI(): OpenAI {
    if (!_openaiInstance) {
      _openaiInstance = new OpenAI({
        apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "placeholder",
        baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
      });
    }
    return _openaiInstance;
  }

const SYSTEM_PROMPT = `You are Zanix, an elite autonomous AI agent. You answer questions directly and completely, and use tools only when truly necessary.

## CRITICAL RULE — Answer First:
- **For any question or request that you can answer from your knowledge, answer it immediately and fully.** Do NOT use tools just to seem busy.
- Simple questions (definitions, explanations, opinions, general knowledge, math, coding help, writing, advice) → answer DIRECTLY without any tool calls.
- Only call tools when you genuinely need live data, external resources, or execution that you cannot provide from knowledge alone.

## When to use tools:
- Web search / browse: only for live news, current prices, real-time data, or URLs the user explicitly wants
- Code execution: only when the user explicitly wants code to be run
- File save: only when the user asks to save or export something
- Calculator: only for complex multi-step calculations
- Image analysis: only when an image is provided

## When NOT to use tools (answer directly instead):
- Explaining concepts, answering factual questions, writing text, translating, giving advice
- Writing code (just write it in your response)
- Solving math you can do mentally
- Anything achievable purely from your training knowledge

## Response quality:
1. **Match user language** — Arabic input → Arabic reply, English input → English reply
2. **Be direct and complete** — give the full answer, not a plan to find the answer
3. **Format beautifully** — use markdown headers, bullet points, code blocks as appropriate
4. **Be concise when possible** — don't pad answers unnecessarily
5. **For complex tasks** — reason step by step, use tools only for steps requiring external data

You are knowledgeable, direct, and highly capable. Answer every question fully and immediately.`;

export interface RunResult {
  success: boolean;
  result: string;
  steps: Array<{
    thought: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    observation: string;
  }>;
  artifacts: Array<{
    name: string;
    type: string;
    content: string;
  }>;
  tokensUsed: number;
}

export async function runAgent(
  taskId: string,
  sessionId: string,
  goal: string,
  registry: ToolRegistry,
  memory: MemoryManager,
  onStep?: (step: string) => void,
  useCritic: boolean = true
): Promise<RunResult> {
  const steps: RunResult["steps"] = [];
  const artifacts: RunResult["artifacts"] = [];
  let totalTokens = 0;
  let stepIndex = 0;

  const memorySnapshot = memory.getLocalSnapshot();
  const memoryContext =
    Object.keys(memorySnapshot).length > 0
      ? `\n\nSession memory:\n${Object.entries(memorySnapshot)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "";

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Task ID: ${taskId}\nSession ID: ${sessionId}\n\nGoal: ${goal}${memoryContext}`,
    },
  ];

  await db
    .update(agentTasksTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(agentTasksTable.taskId, taskId));

  const MAX_ITERATIONS = 20;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    let response: OpenAI.ChatCompletion;
    try {
      response = await getOpenAI().chat.completions.create({
        model: "gpt-5.2",
        messages,
        tools: registry.toOpenAIFormat(),
        tool_choice: "auto",
        max_completion_tokens: 4096,
      });
    } catch (err) {
      logger.error({ err, taskId }, "OpenAI call failed");
      throw err;
    }

    totalTokens += response.usage?.total_tokens ?? 0;

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (choice.finish_reason === "stop" || !assistantMessage.tool_calls?.length) {
      let finalText = assistantMessage.content ?? "Task completed.";

      if (useCritic && finalText.length > 80) {
        try {
          onStep?.("🔍 Self-critique review...");
          const critiqueResult = await runCritic(goal, finalText, 2);
          if (!critiqueResult.approved || critiqueResult.score < 85) {
            finalText = critiqueResult.improvedAnswer;
            logger.info({ taskId, score: critiqueResult.score, rounds: critiqueResult.critiqueRounds }, "Critic improved answer");
          }
        } catch (err) {
          logger.warn({ err }, "Critic failed, using original answer");
        }
      }

      await db
        .update(agentTasksTable)
        .set({
          status: "completed",
          result: finalText,
          updatedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(agentTasksTable.taskId, taskId));

      return { success: true, result: finalText, steps, artifacts, tokensUsed: totalTokens };
    }

    const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolInput: Record<string, unknown> = {};

      try {
        toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        toolInput = {};
      }

      if (["store_memory", "search_memory"].includes(toolName) && !toolInput.sessionId) {
        toolInput.sessionId = sessionId;
      }
      if (["save_file", "list_files"].includes(toolName) && !toolInput.taskId) {
        toolInput.taskId = taskId;
      }

      const tool = registry.get(toolName);
      if (!tool) {
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: `Tool '${toolName}' not found` }),
        });
        continue;
      }

      onStep?.(`⚙️ ${toolName}...`);

      let toolResult: { success: boolean; output: unknown; error?: string };
      try {
        toolResult = await tool.execute(toolInput);
      } catch (err) {
        toolResult = {
          success: false,
          output: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const observation = toolResult.success
        ? JSON.stringify(toolResult.output, null, 2).substring(0, 4000)
        : `Error: ${toolResult.error}`;

      const stepData = {
        thought: assistantMessage.content ?? `Using ${toolName}`,
        toolName,
        toolInput,
        observation,
      };
      steps.push(stepData);

      await db.insert(agentStepsTable).values({
        taskId,
        stepIndex: stepIndex++,
        stepType: "shell" as const,
        thought: stepData.thought,
        toolName,
        toolInput,
        toolOutput: toolResult,
        observation,
      });

      if (toolResult.success && toolInput.content) {
        if (toolName === "save_file") {
          artifacts.push({
            name: String(toolInput.name ?? "file"),
            type: String(toolInput.artifactType ?? "text"),
            content: String(toolInput.content),
          });
        }
      }

      if (toolResult.success && toolName === "build_website" && toolResult.output) {
        const out = toolResult.output as { files?: Array<{ filename: string; content: string }> };
        if (out.files) {
          for (const f of out.files) {
            artifacts.push({ name: f.filename, type: f.filename.split(".").pop() ?? "text", content: f.content });
          }
        }
      }

      if (toolResult.success && toolName === "write_document" && toolResult.output) {
        const out = toolResult.output as { markdownContent?: string; title?: string };
        if (out.markdownContent) {
          artifacts.push({
            name: String(out.title ?? "document") + ".md",
            type: "markdown",
            content: out.markdownContent,
          });
        }
      }

      if (toolResult.success && toolName === "generate_diagram" && toolResult.output) {
        const out = toolResult.output as { renderHtml?: string; diagramType?: string };
        if (out.renderHtml) {
          artifacts.push({
            name: `diagram-${out.diagramType ?? "chart"}.html`,
            type: "html",
            content: out.renderHtml,
          });
        }
      }

      if (toolResult.success && toolName === "debug_code" && toolResult.output) {
        const out = toolResult.output as { fixedCode?: string; language?: string };
        if (out.fixedCode) {
          const ext: Record<string, string> = {
            typescript: "ts", javascript: "js", python: "py", rust: "rs", go: "go",
          };
          artifacts.push({
            name: `fixed-code.${ext[String(out.language ?? "").toLowerCase()] ?? "txt"}`,
            type: "code",
            content: out.fixedCode,
          });
        }
      }

      toolResults.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: observation,
      });
    }

    messages.push(...toolResults);
  }

  const timeoutMsg = "Task reached maximum depth. Partial results were produced.";
  await db
    .update(agentTasksTable)
    .set({ status: "completed", result: timeoutMsg, updatedAt: new Date(), completedAt: new Date() })
    .where(eq(agentTasksTable.taskId, taskId));

  return { success: true, result: timeoutMsg, steps, artifacts, tokensUsed: totalTokens };
}
