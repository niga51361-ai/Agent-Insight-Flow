import type { ToolDefinition, ToolResult } from "./types.js";
import OpenAI from "openai";

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

async function summarizeText(text: string, format: string, language: string): Promise<ToolResult> {
  try {
    const systemPrompt = `You are Zanix AI, an expert at extracting key information and summarizing content clearly and concisely.
Summarize in ${language}. Output format: ${format}.
- 'bullet_points': Use clear bullet points (•) with key facts and insights.
- 'paragraph': Write a flowing, coherent summary paragraph.
- 'structured': Use markdown headers (##) and sections for organized summaries.
- 'tldr': Write a 2-3 sentence TL;DR.
Focus on the most important information. Preserve key numbers, names, and facts.`;

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
        originalWords: text.split(/\s+/).length,
        format,
        language,
        tokensUsed: response.usage?.total_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const textSummarizerTool: ToolDefinition = {
  name: "summarize_text",
  description: "Summarize any text content — articles, web pages, documents, scraped content, or long texts. Supports multiple output formats and languages including Arabic. Preserves key facts, names, and numbers.",
  parameters: {
    text:     { type: "string", description: "The text content to summarize", required: true },
    format:   { type: "string", description: "Output format: 'bullet_points' | 'paragraph' | 'structured' | 'tldr' (default: bullet_points)", required: false },
    language: { type: "string", description: "Language for the summary (e.g., 'Arabic', 'English', 'French'). Default: same as input", required: false },
  },
  execute: async (params) => {
    return summarizeText(
      String(params.text),
      String(params.format ?? "bullet_points"),
      String(params.language ?? "same as input")
    );
  },
};
