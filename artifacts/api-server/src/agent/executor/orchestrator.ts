import OpenAI from "openai";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  orchestrationsTable,
  subAgentRunsTable,
  sharedMemoryBusTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { runSubAgent, type AgentSpecialization, type SubAgentResult } from "./sub-agent.js";
import { getAgentPersonality, type AgentPersonality } from "@workspace/db";
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

export interface SubTaskPlan {
  index: number;
  subGoal: string;
  specialization: AgentSpecialization;
  rationale: string;
  dependsOn: number[];
  priority: "critical" | "high" | "normal";
}

export interface DecompositionPlan {
  orchestrationTitle: string;
  strategy: string;
  subTasks: SubTaskPlan[];
  estimatedAgents: number;
  synthesisApproach: string;
}

export interface OrchestrationResult {
  orchestrationId: string;
  goal: string;
  strategicOverview: string;
  strategy: string;
  subAgentCount: number;
  subResults: SubAgentResult[];
  finalAnswer: string;
  totalTokensUsed: number;
  executionTimeMs: number;
}

async function reflectOnGoal(
  goal: string
): Promise<string> {
  const systemPrompt = `You are an expert AI strategist. Your task is to analyze a complex goal and provide a high-level strategic overview or internal monologue before any decomposition into sub-tasks. This overview should consider potential challenges, necessary steps, and overall approach to achieve the goal effectively.

  Return a concise, yet comprehensive, strategic overview in natural language.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.2", // Using a powerful model for strategic thinking
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze and provide a strategic overview for this goal:\n\n${goal}` },
    ],
    max_completion_tokens: 1024,
  });

  return response.choices[0]?.message?.content ?? "No strategic overview generated.";
}

async function decomposeGoal(
  goal: string,
  maxAgents: number = 5
): Promise<DecompositionPlan> {
  const systemPrompt = `You are an expert AI orchestrator. Decompose the given complex goal into parallel sub-tasks for specialized AI agents.

Available agent specializations:
- "researcher": web search, browsing, information gathering, translation
- "coder": writing code, executing code, debugging
- "builder": websites, diagrams, documents
- "analyst": data analysis, statistics, calculations
- "fetcher": real-time data (weather, prices), HTTP APIs, image analysis  
- "writer": reports, articles, proposals, summaries
- "generalist": any task, all tools available

Rules for decomposition:
1. Identify which parts can run IN PARALLEL (no dependencies between them)
2. Identify which parts must run SEQUENTIALLY (one depends on another's output)
3. Assign the most fitting specialization to each sub-task
4. Keep sub-tasks focused and atomic
5. Maximum ${maxAgents} sub-agents
6. If the goal is simple, use just 1 agent

Return a JSON object:
{
  "orchestrationTitle": "brief title",
  "strategy": "how you'll divide the work",
  "subTasks": [
    {
      "index": 0,
      "subGoal": "specific, self-contained task description",
      "specialization": "researcher|coder|builder|analyst|fetcher|writer|generalist",
      "rationale": "why this specialization",
      "dependsOn": [],
      "priority": "critical|high|normal"
    }
  ],
  "estimatedAgents": 3,
  "synthesisApproach": "how to combine results"
}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Decompose this goal into parallel sub-tasks (max ${maxAgents} agents):\n\n${goal}` },
    ],
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as DecompositionPlan;
  } catch {
    return {
      orchestrationTitle: "Single Agent Task",
      strategy: "Use one generalist agent",
      subTasks: [{ index: 0, subGoal: goal, specialization: "generalist", rationale: "Simple task", dependsOn: [], priority: "critical" }],
      estimatedAgents: 1,
      synthesisApproach: "Return single agent result",
    };
  }
}

async function synthesizeResults(
  goal: string,
  plan: DecompositionPlan,
  results: SubAgentResult[],
  strategicOverview: string
): Promise<string> {
  const successfulResults = results.filter((r) => r.success && r.result);

  if (successfulResults.length === 0) {
    return "All sub-agents failed to complete their tasks.";
  }

  if (successfulResults.length === 1) {
    return successfulResults[0]!.result;
  }

  const resultsSummary = successfulResults
    .map((r, i) => `### Agent ${i + 1} (${r.specialization})\n**Sub-Goal:** ${r.subGoal}\n**Result:**\n${r.result}`)
    .join("\n\n---\n\n");

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `You are a master synthesizer. Combine the outputs from ${results.length} parallel AI agents into a single comprehensive, coherent, well-structured final answer.\n\nStrategic Overview: ${strategicOverview}\nSynthesis approach: ${plan.synthesisApproach}\n\nRules:\n- Integrate all information seamlessly\n- Eliminate redundancy\n- Preserve all unique insights from each agent\n- Structure the output logically\n- Respond in the same language as the original goal\n- Format beautifully with headers, bullet points where appropriate\n- The final answer should feel like it came from one expert, not multiple agents`,
      },
      {
        role: "user",
        content: `Original Goal: ${goal}\n\n## Results from ${results.length} Parallel Agents:\n\n${resultsSummary}\n\n---\n\nNow synthesize these into a single comprehensive final answer:`,
      },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0]?.message?.content ?? resultsSummary;
}

async function runParallelBatch(
  subTasks: SubTaskPlan[],
  orchestrationId: string,
  sessionId: string,
  userId: string,
  sharedContext: string
): Promise<SubAgentResult[]> {
  const promises = subTasks.map((task) => {
    const subAgentId = randomUUID();
    return runSubAgent({
      subAgentId,
      orchestrationId,
      sessionId,
      userId,
      subGoal: task.subGoal,
      specialization: task.specialization,
      subTaskIndex: task.index,
      sharedContext,
      agentPersonality,
    });
  });

  return Promise.all(promises);
}

export async function orchestrate(
  orchestrationId: string,
  sessionId: string,
  userId: string,
  goal: string,
  maxAgents: number = 5
): Promise<OrchestrationResult> {
  const agentPersonality = await getAgentPersonality(userId);

  const startTime = Date.now();

  await db
    .update(orchestrationsTable)
    .set({ status: "decomposing", updatedAt: new Date() })
    .where(eq(orchestrationsTable.orchestrationId, orchestrationId));

  logger.info({ orchestrationId, goal }, "Starting orchestration");

  // Step 1: Reflect on the goal to create a strategic overview
  const strategicOverview = await reflectOnGoal(goal);
  logger.info({ orchestrationId, strategicOverview }, "Strategic overview generated");

  await db
    .update(orchestrationsTable)
    .set({ strategicOverview, updatedAt: new Date() })
    .where(eq(orchestrationsTable.orchestrationId, orchestrationId));


  let plan: DecompositionPlan;
  try {
    plan = await decomposeGoal(goal, maxAgents);
  } catch (err) {
    logger.error({ err }, "Failed to decompose goal");
    plan = {
      orchestrationTitle: "Single Agent Fallback",
      strategy: "Single agent",
      subTasks: [{ index: 0, subGoal: goal, specialization: "generalist", rationale: "Fallback", dependsOn: [], priority: "critical" }],
      estimatedAgents: 1,
      synthesisApproach: "Direct result",
    };
  }

  await db
    .update(orchestrationsTable)
    .set({
      decompositionPlan: plan as unknown as Record<string, unknown>,
      totalSubAgents: plan.subTasks.length,
      status: "running",
      updatedAt: new Date(),
    })
    .where(eq(orchestrationsTable.orchestrationId, orchestrationId));

  for (const task of plan.subTasks) {
    const subAgentId = randomUUID();
    await db.insert(subAgentRunsTable).values({
      subAgentId,
      orchestrationId,
      subTaskIndex: task.index,
      subGoal: task.subGoal,
      specialization: task.specialization as "researcher" | "coder" | "builder" | "analyst" | "fetcher" | "writer" | "generalist",
      status: "pending",
    });
  }

  const allResults: SubAgentResult[] = [];

  const independent = plan.subTasks.filter((t) => t.dependsOn.length === 0);
  const dependent = plan.subTasks.filter((t) => t.dependsOn.length > 0);

  logger.info({ orchestrationId, independent: independent.length, dependent: dependent.length }, "Running sub-agents");

  if (independent.length > 0) {
    const independentResults = await runParallelBatch(
      independent,
      orchestrationId,
      sessionId,
      userId,
      ""
    );
    allResults.push(...independentResults);

    await db
      .update(orchestrationsTable)
      .set({ completedSubAgents: allResults.length, updatedAt: new Date() })
      .where(eq(orchestrationsTable.orchestrationId, orchestrationId));
  }

  if (dependent.length > 0) {
    const sharedContext = allResults
      .filter((r) => r.success)
      .map((r) => `[${r.specialization}] ${r.subGoal}:\n${r.result.substring(0, 800)}`)
      .join("\n\n---\n\n");

    const dependentResults = await runParallelBatch(
      dependent,
      orchestrationId,
      sessionId,
      userId,
      sharedContext
    );
    allResults.push(...dependentResults);
  }

  await db
    .update(orchestrationsTable)
    .set({ status: "synthesizing", updatedAt: new Date() })
    .where(eq(orchestrationsTable.orchestrationId, orchestrationId));

  // Pass strategic overview to synthesis for better context
  const finalAnswer = await synthesizeResults(goal, plan, allResults, strategicOverview);
  const totalTokens = allResults.reduce((sum, r) => sum + r.tokensUsed, 0);
  const executionTimeMs = Date.now() - startTime;

  await db
    .update(orchestrationsTable)
    .set({
      status: "completed",
      finalResult: finalAnswer,
      completedSubAgents: allResults.length,
      totalTokensUsed: totalTokens,
      updatedAt: new Date(),
      completedAt: new Date(),
    })
    .where(eq(orchestrationsTable.orchestrationId, orchestrationId));

    return {
      orchestrationId,
      goal,
      strategicOverview,
      strategy: plan.strategy,
      subAgentCount: allResults.length,
      subResults: allResults,
      finalAnswer,
      totalTokensUsed: totalTokens,
      executionTimeMs,
    };
}
