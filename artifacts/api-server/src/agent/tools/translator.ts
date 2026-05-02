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

async function translateText(
  userId: string,
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  agentPersonality?: AgentPersonality
): Promise<ToolResult> {
  try {
    const source = sourceLanguage ? ` from ${sourceLanguage}` : "";
    const LLM_COST_PER_TOKEN = 0.0000008; // Example cost, adjust as needed
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    const cost = estimatedTokens * LLM_COST_PER_TOKEN;

    const creditsDeducted = await deductCredits(userId, cost, `Text translation (${sourceLanguage || 'auto'} to ${targetLanguage})`);
    if (!creditsDeducted) {
      return { success: false, output: null, error: "Insufficient credits for text translation." };
    }

    const agentName = agentPersonality?.name || "Zanix AI";
    const agentDescription = agentPersonality?.description || "an expert translator";
    const agentTone = agentPersonality?.tone || "accurate, nuanced, and culturally sensitive";

    const systemPrompt = `You are ${agentName}, ${agentDescription}. Your tone is ${agentTone}.
Translate the text${source} to ${targetLanguage} accurately, preserving tone, style, and nuance. Return only the translation without any explanation.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text.substring(0, 10000) },
      ],
      max_completion_tokens: 4096,
    });

    return {
      success: true,
      output: {
        original: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
        translation: response.choices[0]?.message?.content ?? "",
        targetLanguage,
        sourceLanguage: sourceLanguage ?? "auto-detected",
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

export const translatorTool: ToolDefinition = {
  name: "translate",
  description:
    "Translate text between any languages. Supports Arabic, English, French, Spanish, Chinese, German, and many more languages.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    text: {
      type: "string",
      description: "The text to translate",
      required: true,
    },
    targetLanguage: {
      type: "string",
      description: "Target language (e.g., 'Arabic', 'English', 'French', 'Spanish')",
      required: true,
    },
    sourceLanguage: {
      type: "string",
      description: "Source language (optional, auto-detected if not specified)",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const agentPersonality = await getAgentPersonality(userId);
    return translateText(
      userId,
      String(params.text),
      String(params.targetLanguage),
      params.sourceLanguage ? String(params.sourceLanguage) : undefined,
      agentPersonality
    );
  },
};
