import OpenAI from "openai";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  autonomousTasksTable,
  agentSessionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createDefaultRegistry } from "../tools/registry.js";
import { SemanticMemoryManager } from "../memory/semantic-memory.js";
import { runCritic } from "../critic/critic.js";
import { logger } from "../../lib/logger.js";
import { saveCheckpoint, computeDynamicMaxIterations } from "./task-checkpoint.js";
import { compressContext, shouldCompress } from "../memory/context-compressor.js";

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

const AUTOPILOT_SYSTEM_PROMPT = `You are Zanix Autopilot — the world's most powerful autonomous agent operating in long-running mode.

You are executing a complex, multi-step goal that may take many iterations. You have full access to all tools and must work independently to completion.

## Autopilot Rules:
1. **Break down the goal** into logical steps and track your progress
2. **Use tools extensively** — research, code, build, analyze as needed  
3. **Be self-sufficient** — overcome obstacles by trying alternative approaches
4. **Track progress** — store important findings in memory between steps
5. **Report clearly** — maintain a running progress log
6. **Never give up** — if one approach fails, try another
7. **Verify results** — use sandbox execution to test code, use critique to verify answers

## Behavior:
- Work step by step, up to 30 iterations for complex tasks
- Store intermediate results in memory
- The final response must be comprehensive and production-ready
- Always respond in the user's language`;

export interface AutonomousTask {
  id: string;
  goal: string;
  status: "queued" | "running" | "completed" | "failed" | "paused";
  progress: number;
  currentStep: string;
  steps: Array<{ step: string; status: "done" | "running" | "pending"; result?: string }>;
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  sessionId: string;
}

const runningTasks = new Map<string, boolean>();

export async function startAutonomousTask(
  taskId: string,
  sessionId: string,
  goal: string,
  useCritic: boolean = true
): Promise<void> {
  if (runningTasks.get(taskId)) return;
  runningTasks.set(taskId, true);

  const registry = createDefaultRegistry();
  const memory = new SemanticMemoryManager(sessionId);

  await db
    .update(autonomousTasksTable)
    .set({
      status: "running",
      startedAt: new Date(),
      currentStep: "Analyzing goal and creating execution plan...",
      updatedAt: new Date(),
    })
    .where(eq(autonomousTasksTable.taskId, taskId));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: AUTOPILOT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `AUTONOMOUS TASK ID: ${taskId}\nSESSION: ${sessionId}\n\nGOAL: ${goal}\n\nBegin execution. Work autonomously until the goal is fully completed.`,
    },
  ];

  const MAX_ITERATIONS = computeDynamicMaxIterations(goal);
  let iteration = 0;
  let stepIndex = 0;
  const allSteps: string[] = [];
  const memorySnapshot: Record<string, string> = {};

  logger.info({ taskId, maxIterations: MAX_ITERATIONS, goal: goal.substring(0, 80) }, "Starting autopilot with dynamic iteration limit");

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;

      if (shouldCompress(messages as any)) {
        try {
          const compressed = await compressContext(
            messages.map((m) => ({ role: m.role as any, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })),
            goal
          );
          messages.length = 0;
          for (const m of compressed) {
            messages.push({ role: m.role, content: m.content } as OpenAI.ChatCompletionMessageParam);
          }
          logger.info({ taskId, iteration, newMessageCount: messages.length }, "Context compressed in autopilot");
        } catch (err) {
          logger.warn({ err }, "Autopilot context compression failed");
        }
      }

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
        logger.error({ err, taskId }, "Autopilot OpenAI call failed");
        throw err;
      }

      const choice = response.choices[0];
      if (!choice) break;

      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      if (choice.finish_reason === "stop" || !assistantMessage.tool_calls?.length) {
        const finalText = assistantMessage.content ?? "Task completed.";
        let verifiedResult = finalText;

        if (useCritic && finalText.length > 100) {
          try {
            const critiqueResult = await runCritic(goal, finalText, 2);
            verifiedResult = critiqueResult.improvedAnswer;
            await db
              .update(autonomousTasksTable)
              .set({
                currentStep: `Quality check: score ${critiqueResult.score}/100 — ${critiqueResult.approved ? "Approved" : "Improved"}`,
                updatedAt: new Date(),
              })
              .where(eq(autonomousTasksTable.taskId, taskId));
          } catch {
            verifiedResult = finalText;
          }
        }

        await db
          .update(autonomousTasksTable)
          .set({
            status: "completed",
            result: verifiedResult,
            progress: 100,
            currentStep: "Completed",
            completedAt: new Date(),
            updatedAt: new Date(),
            totalIterations: iteration,
          })
          .where(eq(autonomousTasksTable.taskId, taskId));

        runningTasks.delete(taskId);
        return;
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

        if (["store_memory", "search_memory", "semantic_memory_search", "store_memory_semantic"].includes(toolName) && !toolInput.sessionId) {
          toolInput.sessionId = sessionId;
        }

        const tool = registry.get(toolName);
        const currentStepDesc = `[${iteration}/${MAX_ITERATIONS}] ${toolName}${toolInput.query ? `: ${String(toolInput.query).slice(0, 60)}` : ""}`;
        allSteps.push(currentStepDesc);
        stepIndex++;

        const progress = Math.min(95, Math.round((iteration / MAX_ITERATIONS) * 90));

        await db
          .update(autonomousTasksTable)
          .set({
            currentStep: currentStepDesc,
            progress,
            updatedAt: new Date(),
          })
          .where(eq(autonomousTasksTable.taskId, taskId));

        if (["store_memory", "store_memory_semantic"].includes(toolName) && toolInput.key && toolInput.value) {
          memorySnapshot[String(toolInput.key)] = String(toolInput.value).substring(0, 200);
        }

        if (!tool) {
          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool '${toolName}' not found` }),
          });
          continue;
        }

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

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: observation,
        });
      }

      messages.push(...toolResults);
    }

    const timeoutMsg =
      "The autonomous task reached maximum execution depth. Partial results have been produced. The agent completed as much as possible within the iteration limit.";

    await db
      .update(autonomousTasksTable)
      .set({
        status: "completed",
        result: timeoutMsg,
        progress: 100,
        currentStep: "Reached max iterations — partial completion",
        completedAt: new Date(),
        updatedAt: new Date(),
        totalIterations: MAX_ITERATIONS,
      })
      .where(eq(autonomousTasksTable.taskId, taskId));
  } catch (err) {
    logger.error({ err, taskId }, "Autonomous task failed");
    await db
      .update(autonomousTasksTable)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(autonomousTasksTable.taskId, taskId));
  } finally {
    runningTasks.delete(taskId);
  }
}
