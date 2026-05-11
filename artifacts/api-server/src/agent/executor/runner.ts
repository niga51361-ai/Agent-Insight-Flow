import OpenAI from "openai";
import { db } from "@workspace/db";
import { agentTasksTable, agentStepsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ToolRegistry } from "../tools/registry.js";
import type { MemoryManager } from "../memory/manager.js";
import { logger } from "../../lib/logger.js";
import { getOpenAI } from "../../lib/openai.js";

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Zanix ⚡, an elite autonomous AI agent built by Zanix AI. You are fast, brilliant, and highly capable — the smartest AI assistant available.

## 🚀 CRITICAL — Speed First:
- Answer DIRECTLY and IMMEDIATELY from your knowledge whenever you can.
- DO NOT call tools unless you genuinely need external/live data or must perform an action.
- Simple factual questions, explanations, code writing → answer inline in ONE response.

## 🛠️ Tool Usage — When to call tools:
| Tool | When to use |
|------|------------|
| web_search | Live news, recent events, current prices, facts you're unsure about |
| browse_web | Read a specific URL, article, or web page |
| get_realtime_data | Current weather, exchange rates, or crypto prices |
| execute_code | User wants code EXECUTED/RUN to produce output |
| sandbox_execute | JavaScript logic/algorithm verification |
| generate_image | User asks for an image, illustration, diagram, or visual |
| save_file | Save a generated file for download |
| analyze_data | Extract insights from a dataset |
| translate | Translate text between languages |
| summarize_text | Condense long content |
| http_request | Call an external API |
| calculate | Complex multi-step math |
| debug_code | Fix code bugs |

## ❌ When NOT to use tools:
- Writing code (write it inline in markdown code blocks)
- Explaining concepts, answering factual questions
- Math you can do in your head
- Translating short phrases (just translate directly)

## 🖼️ Image generation — IMPORTANT:
- When user says "show me", "draw", "create image", "generate picture" → ALWAYS use generate_image.
- When explaining a visual concept (diagrams, charts, UI mockups) → use generate_image to illustrate.
- When building a website/game/app → optionally generate a preview concept image.
- After generating image, present the result in your response naturally.

## 💻 Code Writing Rules:
- Always wrap code in proper markdown fenced code blocks with language tag: \`\`\`typescript\`\`\`
- For complete HTML/CSS/JS apps or games: write FULL complete code in one block.
- Mark standalone complete HTML files with a comment: <!-- zanix-preview -->
- Python scripts → use code blocks, offer to execute if user wants output.

## 🌟 Communication Style — CRITICAL:
- USE EMOJIS naturally throughout ALL responses (in headers, bullet points, conclusions).
- Start every response with 1-2 relevant emojis.
- Be warm, enthusiastic, energetic, and engaging.
- Match user's language EXACTLY — Arabic input → Arabic reply; English input → English reply.
- Arabic responses: use Modern Standard Arabic (فصحى) mixed with natural warmth.
- Format beautifully: markdown headers (##), bold (**text**), bullets, numbered lists.
- Be direct and complete — give the FULL answer, not just a plan.

## 🔧 Multi-step tasks:
- Plan → Execute → Verify → Summarize.
- After each tool call, analyze the result and decide next step.
- If a tool fails, try an alternative approach (different tool or direct answer).
- Always end with a clear, formatted summary of what was accomplished.

You are brilliant, enthusiastic, and highly capable. Answer every question fully with energy and clarity! ✨`;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface StepEvent {
  stepIndex: number;
  stepType: string;
  thought: string | null;
  toolName: string | null;
  toolInput: Record<string, unknown>;
  observation: string;
  status: "running" | "completed" | "failed";
}

export interface RunResult {
  success: boolean;
  result: string;
  steps: Array<{
    thought: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    observation: string;
  }>;
  artifacts: Array<{ name: string; type: string; content: string }>;
  tokensUsed: number;
}

// Tools that receive sessionId injected by the runner
const SESSION_TOOLS = new Set([
  "store_memory",
  "search_memory",
  "semantic_search_memory",
  "semantic_store_memory",
]);

// Tools that receive taskId injected by the runner
const TASK_TOOLS = new Set(["save_file", "list_files"]);

// ─── Main Runner ──────────────────────────────────────────────────────────────
export async function runAgent(
  taskId: string,
  sessionId: string,
  goal: string,
  registry: ToolRegistry,
  memory: MemoryManager,
  onStep?: (step: StepEvent) => void,
  model: string = "gpt-5.2",
  images?: string[]
): Promise<RunResult> {
  const steps: RunResult["steps"] = [];
  const artifacts: RunResult["artifacts"] = [];
  let totalTokens = 0;
  let stepIndex = 0;

  const memorySnapshot = memory.getLocalSnapshot();
  const memoryContext =
    Object.keys(memorySnapshot).length > 0
      ? `\n\n[Session Memory]\n${Object.entries(memorySnapshot)
          .map(([k, v]) => `• ${k}: ${v}`)
          .join("\n")}`
      : "";

  const userContent: OpenAI.ChatCompletionContentPart[] = [
    { type: "text", text: `${goal}${memoryContext}` },
  ];

  if (images && images.length > 0) {
    for (const img of images) {
      userContent.push({
        type: "image_url",
        image_url: { url: img, detail: "high" },
      });
    }
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        userContent.length === 1 && userContent[0]?.type === "text"
          ? (userContent[0] as OpenAI.ChatCompletionContentPartText).text
          : userContent,
    },
  ];

  await db
    .update(agentTasksTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(agentTasksTable.taskId, taskId));

  const MAX_ITERATIONS = 15;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    let response: OpenAI.ChatCompletion;
    try {
      response = await getOpenAI().chat.completions.create({
        model,
        messages,
        tools: registry.toOpenAIFormat(),
        tool_choice: "auto",
        max_completion_tokens: 8192,
      });
    } catch (err) {
      logger.error({ err, taskId, iteration }, "OpenAI API call failed");
      throw err;
    }

    totalTokens += response.usage?.total_tokens ?? 0;

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // Done — no tool calls
    if (choice.finish_reason === "stop" || !assistantMessage.tool_calls?.length) {
      const finalText = assistantMessage.content ?? "Task completed.";

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
        toolInput = JSON.parse(toolCall.function.arguments) as Record<
          string,
          unknown
        >;
      } catch {
        toolInput = {};
      }

      // Inject context params — the agent doesn't need to know these
      if (SESSION_TOOLS.has(toolName)) toolInput.sessionId = sessionId;
      if (TASK_TOOLS.has(toolName)) toolInput.taskId = taskId;

      const tool = registry.get(toolName);
      if (!tool) {
        const available = registry.names().join(", ");
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            error: `Tool '${toolName}' not found. Available: ${available}`,
          }),
        });
        continue;
      }

      // Emit "running" event immediately
      onStep?.({
        stepIndex,
        stepType: toolName,
        thought: assistantMessage.content ?? null,
        toolName,
        toolInput,
        observation: "",
        status: "running",
      });

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
        ? JSON.stringify(toolResult.output, null, 2).substring(0, 5000)
        : `Error: ${toolResult.error ?? "Unknown error"}`;

      const stepData = {
        thought: assistantMessage.content ?? `Using ${toolName}`,
        toolName,
        toolInput,
        observation,
      };
      steps.push(stepData);

      // Persist step to DB
      try {
        await db.insert(agentStepsTable).values({
          taskId,
          stepIndex,
          stepType: "shell" as const,
          thought: stepData.thought,
          toolName,
          toolInput,
          toolOutput: toolResult,
          observation,
        });
      } catch (dbErr) {
        logger.warn({ dbErr, taskId, toolName }, "Failed to persist step to DB");
      }

      // Emit "completed" event
      onStep?.({
        stepIndex,
        stepType: toolName,
        thought: stepData.thought,
        toolName,
        toolInput,
        observation,
        status: toolResult.success ? "completed" : "failed",
      });

      stepIndex++;

      // Collect artifacts from file saves
      if (toolResult.success && toolName === "save_file" && toolInput.content) {
        artifacts.push({
          name: String(toolInput.name ?? "file"),
          type: String(toolInput.artifactType ?? "text"),
          content: String(toolInput.content),
        });
      }

      // Collect artifacts from website builder
      if (
        toolResult.success &&
        toolName === "build_website" &&
        toolResult.output
      ) {
        const out = toolResult.output as {
          files?: Array<{ filename: string; content: string }>;
        };
        if (out.files) {
          for (const f of out.files) {
            artifacts.push({
              name: f.filename,
              type: f.filename.split(".").pop() ?? "text",
              content: f.content,
            });
          }
        }
      }

      // Collect image artifacts
      if (
        toolResult.success &&
        toolName === "generate_image" &&
        toolResult.output
      ) {
        const out = toolResult.output as {
          imageUrl?: string;
          b64?: string;
          prompt?: string;
        };
        if (out.imageUrl || out.b64) {
          artifacts.push({
            name: `image-${stepIndex}.png`,
            type: "image",
            content: out.imageUrl ?? `data:image/png;base64,${out.b64}`,
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

  const timeoutMsg =
    "⚠️ Task reached maximum iteration depth. Partial results were produced.";
  await db
    .update(agentTasksTable)
    .set({
      status: "completed",
      result: timeoutMsg,
      updatedAt: new Date(),
      completedAt: new Date(),
    })
    .where(eq(agentTasksTable.taskId, taskId));

  return {
    success: true,
    result: timeoutMsg,
    steps,
    artifacts,
    tokensUsed: totalTokens,
  };
}
