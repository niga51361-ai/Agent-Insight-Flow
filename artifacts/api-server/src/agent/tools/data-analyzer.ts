import type { ToolDefinition, ToolResult } from "./types.js";
import OpenAI from "openai";
import { deductCredits, getAgentPersonality, type AgentPersonality } from "@workspace/db";

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

async function analyzeData(
  userId: string,
  data: string,
  question: string,
  outputFormat: string,
  agentPersonality?: AgentPersonality
): Promise<ToolResult> {
  try {
    const LLM_COST_PER_TOKEN = 0.0000015; // Example cost, adjust as needed
    const estimatedTokens = Math.ceil((data.length + question.length) / 4); // Rough estimate
    const cost = estimatedTokens * LLM_COST_PER_TOKEN;

    const creditsDeducted = await deductCredits(userId, cost, `Data analysis (${outputFormat})`);
    if (!creditsDeducted) {
      return { success: false, output: null, error: "Insufficient credits for data analysis." };
    }

    const agentName = agentPersonality?.name || "Zanix AI";
    const agentDescription = agentPersonality?.description || "an expert data analyst";
    const agentTone = agentPersonality?.tone || "accurate and insightful";

    const systemPrompt = `You are ${agentName}, ${agentDescription}. Your tone is ${agentTone}.
Analyze the provided data and answer the question accurately.
Output format: ${outputFormat}.
For 'json': return structured JSON with findings, insights, and statistics.
For 'table': return a markdown table with organized data.
For 'narrative': write a clear analytical paragraph.
For 'bullets': use bullet points for key findings.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Data to analyze:\n\`\`\`\n${data.substring(0, 10000)}\n\`\`\`\n\nQuestion: ${question}`,
        },
      ],
      max_completion_tokens: 2048,
    });

    return {
      success: true,
      output: {
        analysis: response.choices[0]?.message?.content ?? "",
        question,
        outputFormat,
        dataLength: data.length,
      },
    };
  } catch (err) {
    return {
      success: false,
      output: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const dataAnalyzerTool: ToolDefinition = {
  name: "analyze_data",
  description:
    "Analyze any data (text, JSON, CSV, numbers, tables) and extract insights, patterns, or answer specific questions about it.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    data: {
      type: "string",
      description: "The data to analyze (text, JSON, CSV, numbers, etc.)",
      required: true,
    },
    question: {
      type: "string",
      description: "The specific question or analysis task to perform on the data",
      required: true,
    },
    outputFormat: {
      type: "string",
      description: "Output format: 'json', 'table', 'narrative', or 'bullets'",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const agentPersonality = await getAgentPersonality(userId);
    return analyzeData(
      userId,
      String(params.data),
      String(params.question),
      String(params.outputFormat ?? "bullets"),
      agentPersonality
    );
  },
};
