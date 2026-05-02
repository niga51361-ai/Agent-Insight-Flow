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

async function summarizeText(userId: string, text: string, format: string, language: string, agentPersonality?: AgentPersonality): Promise<ToolResult> {
  try {
    const LLM_COST_PER_TOKEN = 0.0000005; // Example cost, adjust as needed
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    const cost = estimatedTokens * LLM_COST_PER_TOKEN;

    const creditsDeducted = await deductCredits(userId, cost, `Text summarization (${language})`);
    if (!creditsDeducted) {
      return { success: false, output: null, error: "Insufficient credits for text summarization." };
    }

    const agentName = agentPersonality?.name || "Zanix AI";
    const agentDescription = agentPersonality?.description || "an expert at extracting key information and summarizing content";
    const agentTone = agentPersonality?.tone || "clear and concise";

    const systemPrompt = `You are ${agentName}, ${agentDescription}. Your tone is ${agentTone}.
Summarize in ${language}. Output format: ${format}.
For 'bullet_points': use clear bullet points with key facts.
For 'paragraph': write a coherent flowing summary.
For 'structured': use headers and sections.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Summarize this content:\n\n${text.substring(0, 12000)}` },
      ],
      max_completion_tokens: 1024,
    });

    return {
      success: true,
      output: {
        summary: response.choices[0]?.message?.content ?? "",
        originalLength: text.length,
        format,
        language,
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

export const textSummarizerTool: ToolDefinition = {
  name: "summarize_text",
  description:
    "Summarize any text content — articles, web pages, documents, or long texts. Supports multiple output formats and languages.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    text: {
      type: "string",
      description: "The text content to summarize",
      required: true,
    },
    format: {
      type: "string",
      description: "Output format: 'bullet_points', 'paragraph', or 'structured'",
      required: false,
    },
    language: {
      type: "string",
      description: "Language for the summary output (e.g., 'Arabic', 'English', 'French')",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const agentPersonality = await getAgentPersonality(userId);
    return summarizeText(
      userId,
      String(params.text),
      String(params.format ?? "bullet_points"),
      String(params.language ?? "English"),
      agentPersonality
    );
  },
};
