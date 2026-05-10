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

async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  preserveFormatting?: boolean
): Promise<ToolResult> {
  try {
    const source = sourceLanguage ? ` from ${sourceLanguage}` : "";
    const systemPrompt = `You are Zanix AI's translation engine — an expert translator and linguist.
Translate the text${source} to ${targetLanguage} with:
- Accurate meaning and correct grammar
- Preserved tone and style (formal/informal/technical)
- Cultural sensitivity and natural phrasing
- Preserved formatting, numbers, and proper nouns${preserveFormatting ? "\n- Keep all markdown, HTML tags, and special formatting intact" : ""}
Return ONLY the translation — no explanations, no notes, no original text.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text.substring(0, 10000) },
      ],
      max_completion_tokens: 4096,
    });

    const translation = response.choices[0]?.message?.content ?? "";

    return {
      success: true,
      output: {
        originalPreview: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
        translation,
        targetLanguage,
        sourceLanguage: sourceLanguage ?? "auto-detected",
        originalLength: text.length,
        translatedLength: translation.length,
        tokensUsed: response.usage?.total_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const translatorTool: ToolDefinition = {
  name: "translate",
  description: "Translate text between 100+ languages with high accuracy. Preserves tone, style, cultural nuance, and formatting. Supports Arabic, English, French, Spanish, Chinese, German, Japanese, Russian, Turkish, and many more.",
  parameters: {
    text:               { type: "string",  description: "The text to translate", required: true },
    targetLanguage:     { type: "string",  description: "Target language (e.g., 'Arabic', 'English', 'French', 'Spanish', 'Chinese', 'Japanese')", required: true },
    sourceLanguage:     { type: "string",  description: "Source language (optional — auto-detected if not specified)", required: false },
    preserveFormatting: { type: "boolean", description: "Set true to preserve markdown/HTML formatting in the translation (default: false)", required: false },
  },
  execute: async (params) => {
    return translateText(
      String(params.text),
      String(params.targetLanguage),
      params.sourceLanguage ? String(params.sourceLanguage) : undefined,
      Boolean(params.preserveFormatting)
    );
  },
};
