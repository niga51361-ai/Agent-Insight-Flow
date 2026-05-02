import OpenAI from "openai";
import { db } from "@workspace/db";
import { subAgentRunsTable, sharedMemoryBusTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createDefaultRegistry, ToolRegistry } from "../tools/registry.js";
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

export type AgentSpecialization =
  | "researcher"
  | "coder"
  | "builder"
  | "analyst"
  | "fetcher"
  | "writer"
  | "generalist";

import { deductCredits, type AgentPersonality } from "@workspace/db"; // Import deductCredits and AgentPersonality

export interface SubAgentConfig {
  subAgentId: string;
  orchestrationId: string;
  sessionId: string;
  userId: string;
  subGoal: string;
  specialization: AgentSpecialization;
  subTaskIndex: number;
  sharedContext?: string;
  agentPersonality?: AgentPersonality; // Add agentPersonality
}

export interface SubAgentResult {
  subAgentId: string;
  subGoal: string;
  specialization: AgentSpecialization;
  success: boolean;
  result: string;
  steps: Array<{ toolName: string; observation: string }>;
  artifacts: Array<{ name: string; type: string; content: string }>;
  tokensUsed: number;
  error?: string;
  retryAttempts?: number;
}

const SPECIALIZATION_TOOLS: Record<AgentSpecialization, string[]> = {
  researcher: ["web_search", "browse_web", "summarize_text", "translate", "store_memory", "search_memory"],
  coder: ["write_code", "execute_code", "debug_code", "calculate", "save_file", "analyze_data"],
  builder: ["build_website", "write_code", "generate_diagram", "write_document", "save_file"],
  analyst: ["analyze_data", "process_data", "calculate", "generate_diagram", "summarize_text"],
  fetcher: ["http_request", "get_realtime_data", "browse_web", "analyze_image", "web_search"],
  writer: ["write_document", "summarize_text", "translate", "analyze_data", "save_file"],
  generalist: [], // all tools
};

const SPECIALIZATION_PROMPTS: Record<AgentSpecialization, string> = {
  researcher: "You are a Research Agent. Specialize in finding, browsing, and synthesizing information from the web. Search multiple sources, verify facts, and provide comprehensive findings.",
  coder: "You are a Code Agent. Specialize in writing, executing, testing, and debugging code. Produce clean, working, production-ready code with examples and documentation.",
  builder: "You are a Builder Agent. Specialize in creating websites, diagrams, and documents. Produce complete, professional, visually appealing outputs.",
  analyst: "You are an Analysis Agent. Specialize in analyzing data, computing statistics, finding patterns, and generating insights. Be precise and data-driven.",
  fetcher: "You are a Data Fetcher Agent. Specialize in retrieving real-time information: APIs, web pages, live data (weather, stocks, crypto). Ensure data accuracy.",
  writer: "You are a Writing Agent. Specialize in creating professional documents, reports, summaries, and translations. Produce polished, well-structured content.",
  generalist: "You are a General-Purpose Agent with access to all tools. Complete your assigned sub-task thoroughly using the most appropriate tools.",
};

function buildSubRegistry(
  fullRegistry: ToolRegistry,
  specialization: AgentSpecialization
): ToolRegistry {
  if (specialization === "generalist") return fullRegistry;

  const allowedTools = SPECIALIZATION_TOOLS[specialization];
  const allTools = fullRegistry.getAll();
  const subRegistry = new ToolRegistry();

  for (const tool of allTools) {
    if (allowedTools.includes(tool.name)) {
      subRegistry.register(tool);
    }
  }

  return subRegistry;
}

async function postToSharedBus(
  orchestrationId: string,
  subAgentId: string,
  key: string,
  value: string
): Promise<void> {
  try {
    await db.insert(sharedMemoryBusTable).values({
      orchestrationId,
      subAgentId,
      key,
      value,
      valueType: "text",
    });
  } catch {
    // Non-critical
  }
}

import { deductCredits } from "@workspace/db"; // Import deductCredits

export async function runSubAgent(config: SubAgentConfig): Promise<SubAgentResult> {
  const {
    subAgentId,
    orchestrationId,
    sessionId,
    userId,
    subGoal,
    specialization,
    subTaskIndex,
    sharedContext,
    agentPersonality,
  } = config;

  await db
    .update(subAgentRunsTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(subAgentRunsTable.subAgentId, subAgentId));

  const fullRegistry = createDefaultRegistry();
  const registry = buildSubRegistry(fullRegistry, specialization);
  const steps: SubAgentResult["steps"] = [];
  const artifacts: SubAgentResult["artifacts"] = [];
  let totalTokens = 0;

  const contextSection = sharedContext
    ? `\n\nShared context from other agents:\n${sharedContext}`
    : "";

  const agentName = agentPersonality?.name || "Zanix AI";
  const agentDescription = agentPersonality?.description || "an intelligent AI assistant";
  const agentTone = agentPersonality?.tone || "helpful and professional";

  const systemPrompt = `You are ${agentName}, ${agentDescription}. Your tone is ${agentTone}.
${SPECIALIZATION_PROMPTS[specialization]}

        You are Sub-Agent #${subTaskIndex + 1} in a parallel multi-agent system.
        Orchestration ID: ${orchestrationId}
        Your Sub-Task: Complete your assigned goal efficiently using available tools.
        Store important findings using store_memory so other agents can access them.
        Be concise but thorough.`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Session ID: ${sessionId}\nSub-Goal: ${subGoal}${contextSection}`,
    },
  ];

  const MAX_ITERATIONS = 10;
  const MAX_RETRY_ATTEMPTS = 3; // Max attempts for self-correction
  let iteration = 0;
  let retryCount = 0;

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;

      const LLM_COST_PER_TOKEN = 0.000001; // Example cost for sub-agent's LLM calls
      const estimatedTokens = Math.ceil((systemPrompt.length + subGoal.length + (sharedContext?.length || 0)) / 4); // Rough estimate
      const cost = estimatedTokens * LLM_COST_PER_TOKEN;

      const creditsDeducted = await deductCredits(userId, cost, `Sub-agent (${specialization}) reasoning`);
      if (!creditsDeducted) {
        return {
          subAgentId,
          subGoal,
          specialization,
          success: false,
          result: "",
          steps: [],
          artifacts: [],
          tokensUsed: 0,
          error: "Insufficient credits for sub-agent reasoning.",
          retryAttempts: retryCount,
        };
      }

      const response = await getOpenAI().chat.completions.create({
        model: "gpt-5.2",
        messages,
        tools: registry.toOpenAIFormat(),
        tool_choice: "auto",
        max_completion_tokens: 3000,
      });

      totalTokens += response.usage?.total_tokens ?? 0;
      const choice = response.choices[0];
      if (!choice) break;

      const assistantMsg = choice.message;
      messages.push(assistantMsg);

      if (choice.finish_reason === "stop" || !assistantMsg.tool_calls?.length) {
        const finalText = assistantMsg.content ?? "Sub-task completed.";

        await postToSharedBus(
          orchestrationId,
          subAgentId,
          `sub_agent_${subTaskIndex}_result`,
          finalText
        );

        await db
          .update(subAgentRunsTable)
          .set({
            status: "completed",
            result: finalText,
            steps: steps as unknown as Record<string, unknown>[],
            artifacts: artifacts as unknown as Record<string, unknown>[],
            tokensUsed: totalTokens,
            updatedAt: new Date(),
            completedAt: new Date(),
          })
          .where(eq(subAgentRunsTable.subAgentId, subAgentId));

        return {
          subAgentId,
          subGoal,
          specialization,
          success: true,
          result: finalText,
          steps,
          artifacts,
          tokensUsed: totalTokens,
          retryAttempts: retryCount,
        };
      }

      const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];

      for (const toolCall of assistantMsg.tool_calls) {
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
          toolInput.taskId = subAgentId;
        }

        const tool = registry.get(toolName);
        if (!tool) {
          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool not available: ${toolName}` }),
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

          // Self-correction logic
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            retryCount++;
            logger.warn({ subAgentId, toolName, error: toolResult.error }, `Tool execution failed, attempting self-correction (attempt ${retryCount}/${MAX_RETRY_ATTEMPTS})`);
            messages.push({
              role: "user",
              content: `Previous tool call to ${toolName} failed with error: ${toolResult.error}. Analyze the error and try to fix it. You have ${MAX_RETRY_ATTEMPTS - retryCount} retry attempts left.`,
            });
            // Skip adding the failed tool result to messages for now, let the agent try again
            continue; 
          } else {
            logger.error({ subAgentId, toolName, error: toolResult.error }, "Tool execution failed after max retries.");
          }
        }

        const observation = toolResult.success
          ? JSON.stringify(toolResult.output, null, 2).substring(0, 3000)
          : `Error: ${toolResult.error}`;

        steps.push({ toolName, observation: observation.substring(0, 500) });

        if (toolResult.success && toolInput.content && toolName === "save_file") {
          artifacts.push({
            name: String(toolInput.name ?? "file"),
            type: String(toolInput.artifactType ?? "text"),
            content: String(toolInput.content),
          });
        }

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: observation,
        });
      }

      // Only push tool results if we are not in a retry loop (i.e., if the tool actually succeeded or max retries reached)
      if (toolResults.length > 0 || retryCount >= MAX_RETRY_ATTEMPTS) {
        messages.push(...toolResults);
      }
    }

    const fallback = "Sub-task completed (reached iteration limit).";
    await db
      .update(subAgentRunsTable)
      .set({
        status: "completed",
        result: fallback,
        steps: steps as unknown as Record<string, unknown>[],
        artifacts: artifacts as unknown as Record<string, unknown>[],
        tokensUsed: totalTokens,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(subAgentRunsTable.subAgentId, subAgentId));

    return { subAgentId, subGoal, specialization, success: true, result: fallback, steps, artifacts, tokensUsed: totalTokens, retryAttempts: retryCount };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err, subAgentId, orchestrationId }, "Sub-agent failed");

    await db
      .update(subAgentRunsTable)
      .set({
        status: "failed",
        errorMessage: errorMsg,
        tokensUsed: totalTokens,
        updatedAt: new Date(),
      })
      .where(eq(subAgentRunsTable.subAgentId, subAgentId));

    return { subAgentId, subGoal, specialization, success: false, result: "", steps, artifacts, tokensUsed: totalTokens, error: errorMsg, retryAttempts: retryCount };
  }
}
