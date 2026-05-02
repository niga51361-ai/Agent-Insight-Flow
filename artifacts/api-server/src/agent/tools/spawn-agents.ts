import type { ToolDefinition, ToolResult } from "./types.js";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { orchestrationsTable, subAgentRunsTable } from "@workspace/db";
import { orchestrate } from "../executor/orchestrator.js";

export const spawnAgentsTool: ToolDefinition = {
  name: "spawn_agents",
  description:
    "Spawn multiple specialized AI sub-agents that work IN PARALLEL to complete complex tasks faster. Each sub-agent has a focused specialization (researcher, coder, builder, analyst, fetcher, writer). Results are automatically aggregated. Use this when a task has multiple independent parts that can be done simultaneously — e.g., 'search for X AND build Y AND fetch Z' can all happen at once.",
  parameters: {
    goal: {
      type: "string",
      description: "The complex goal to decompose and execute with multiple parallel agents",
      required: true,
    },
    sessionId: {
      type: "string",
      description: "The current session ID",
      required: true,
    },
    maxAgents: {
      type: "number",
      description: "Maximum number of parallel agents to spawn (1-6, default: 4)",
      required: false,
    },
    subTasks: {
      type: "array",
      description:
        "Optional: Manually specify sub-tasks instead of auto-decomposing. Each item: {subGoal: string, specialization: string}",
      required: false,
      items: { type: "object" },
    },
  },
  execute: async (params): Promise<ToolResult> => {
    const goal = String(params.goal);
    const sessionId = String(params.sessionId ?? "");
    const maxAgents = Math.min(Math.max(Number(params.maxAgents ?? 4), 1), 6);

    const orchestrationId = randomUUID();

    await db.insert(orchestrationsTable).values({
      orchestrationId,
      sessionId,
      parentGoal: goal,
      status: "decomposing",
    });

    if (Array.isArray(params.subTasks) && params.subTasks.length > 0) {
      const validSpecs = ["researcher", "coder", "builder", "analyst", "fetcher", "writer", "generalist"];
      for (let i = 0; i < params.subTasks.length; i++) {
        const st = params.subTasks[i] as { subGoal?: string; specialization?: string };
        const spec = validSpecs.includes(String(st.specialization ?? ""))
          ? String(st.specialization)
          : "generalist";
        await db.insert(subAgentRunsTable).values({
          subAgentId: randomUUID(),
          orchestrationId,
          subTaskIndex: i,
          subGoal: String(st.subGoal ?? `Sub-task ${i + 1}`),
          specialization: spec as "researcher" | "coder" | "builder" | "analyst" | "fetcher" | "writer" | "generalist",
          status: "pending",
        });
      }
    }

    try {
      const result = await orchestrate(orchestrationId, sessionId, goal, maxAgents);

      return {
        success: true,
        output: {
          orchestrationId: result.orchestrationId,
          strategy: result.strategy,
          agentsSpawned: result.subAgentCount,
          executionTimeMs: result.executionTimeMs,
          finalAnswer: result.finalAnswer,
          subResults: result.subResults.map((r) => ({
            specialization: r.specialization,
            subGoal: r.subGoal,
            success: r.success,
            resultSummary: r.result.substring(0, 300),
            stepsCount: r.steps.length,
            artifactsCount: r.artifacts.length,
          })),
          totalTokensUsed: result.totalTokensUsed,
          artifactsGenerated: result.subResults.flatMap((r) => r.artifacts).length,
        },
      };
    } catch (err) {
      return {
        success: false,
        output: { orchestrationId },
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
