import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  agentTasksTable,
  agentStepsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ToolRegistry } from "../tools/registry.js";
import type { MemoryManager } from "../memory/manager.js";
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

// ─── System prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Zanix ⚡, an elite autonomous AI agent built by Zanix AI. You are fast, direct, brilliant, and highly capable.

## 🚀 CRITICAL — Speed First:
- Answer DIRECTLY and IMMEDIATELY from your knowledge for any question you can.
- DO NOT use tools unless you genuinely need live/external data.
- Simple questions → answer in ONE response with no tool calls.

## 🛠️ When to use tools:
- Web search: live news, current prices, real-time events
- Code execution: user explicitly wants code RUN (not just written)
- generate_image: user asks for an image, illustration, diagram, or visual
- File save: user asks to save/export
- Calculator: complex multi-step math only

## ❌ When NOT to use tools:
- Writing code (just write it in the response as markdown code blocks)
- Explaining concepts, answering factual questions, translations
- Math you can do mentally

## 🎨 Image generation:
- When explaining a concept that benefits from visuals, call generate_image to illustrate it.
- When user asks "show me", "draw", "generate image of", always use generate_image tool.
- When writing code for a game/website, also generate a preview screenshot concept.

## 💻 Code output:
- Always wrap code in proper markdown fenced code blocks with language identifier.
- For complete HTML/CSS/JS apps or games, write the FULL complete code in one code block.
- Mark complete standalone HTML files with a comment: <!-- zanix-preview -->

## 🌟 Communication style — CRITICAL:
- USE EMOJIS naturally and expressively throughout ALL responses.
- Start every response with a relevant emoji or two.
- Use emojis to highlight sections, key points, and conclusions.
- Be warm, enthusiastic, and engaging.
- Match user language — Arabic input → Arabic reply with Arabic emojis context.
- Example good response: "✅ بكل سرور! 🎯 إليك الحل..."
- Example good response: "🚀 Great question! Here's what you need to know..."

## 📝 Response quality:
1. Match user language — Arabic input → Arabic reply
2. Be direct and complete — full answer, not a plan
3. Format beautifully — markdown headers, bullets, code blocks
4. Use emojis in every section header and key point
5. For Arabic replies, be natural, warm and conversational

You are brilliant, enthusiastic, and highly capable. Answer every question fully with energy and emoji flair! ✨`;

// ─── Step event type ──────────────────────────────────────────────────
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
      ? `\n\nSession memory:\n${Object.entries(memorySnapshot)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "";

  const userContent: OpenAI.ChatCompletionContentPart[] = [
    { type: "text", text: `Goal: ${goal}${memoryContext}` },
  ];

  if (images && images.length > 0) {
    for (const img of images) {
      userContent.push({ type: "image_url", image_url: { url: img, detail: "high" } });
    }
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: userContent.length === 1 ? userContent[0].type === "text" ? (userContent[0] as OpenAI.ChatCompletionContentPartText).text : userContent : userContent,
    },
  ];

  await db
    .update(agentTasksTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(agentTasksTable.taskId, taskId));

  const MAX_ITERATIONS = 12;
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
      logger.error({ err, taskId }, "OpenAI call failed");
      throw err;
    }

    totalTokens += response.usage?.total_tokens ?? 0;

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

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

      // Emit "running" step immediately
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
        ? JSON.stringify(toolResult.output, null, 2).substring(0, 4000)
        : `Error: ${toolResult.error}`;

      const stepData = {
        thought: assistantMessage.content ?? `Using ${toolName}`,
        toolName,
        toolInput,
        observation,
      };
      steps.push(stepData);

      // Persist step to DB
      await db.insert(agentStepsTable).values({
        taskId,
        stepIndex: stepIndex,
        stepType: "shell" as const,
        thought: stepData.thought,
        toolName,
        toolInput,
        toolOutput: toolResult,
        observation,
      });

      // Emit "completed" step event
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

      // Handle artifacts
      if (toolResult.success && toolName === "save_file" && toolInput.content) {
        artifacts.push({
          name: String(toolInput.name ?? "file"),
          type: String(toolInput.artifactType ?? "text"),
          content: String(toolInput.content),
        });
      }

      if (toolResult.success && toolName === "build_website" && toolResult.output) {
        const out = toolResult.output as { files?: Array<{ filename: string; content: string }> };
        if (out.files) {
          for (const f of out.files) {
            artifacts.push({ name: f.filename, type: f.filename.split(".").pop() ?? "text", content: f.content });
          }
        }
      }

      if (toolResult.success && toolName === "generate_image" && toolResult.output) {
        const out = toolResult.output as { imageUrl?: string; b64?: string; prompt?: string };
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

  const timeoutMsg = "Task reached maximum depth. Partial results were produced.";
  await db
    .update(agentTasksTable)
    .set({ status: "completed", result: timeoutMsg, updatedAt: new Date(), completedAt: new Date() })
    .where(eq(agentTasksTable.taskId, taskId));

  return { success: true, result: timeoutMsg, steps, artifacts, tokensUsed: totalTokens };
}
