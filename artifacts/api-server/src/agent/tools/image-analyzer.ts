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

async function analyzeImage(
  imageUrl: string,
  question: string,
  detail: "low" | "high"
): Promise<ToolResult> {
  try {
    new URL(imageUrl);
  } catch {
    return { success: false, output: null, error: "Invalid image URL — must be a fully qualified http/https URL." };
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail },
            },
            {
              type: "text",
              text: question || "Describe this image in detail. Extract all visible text (OCR), identify all objects, colors, layout, any charts/graphs/data, and notable features. Be thorough and specific.",
            },
          ],
        },
      ],
      max_completion_tokens: 2048,
    });

    return {
      success: true,
      output: {
        imageUrl,
        question: question || "Full description",
        analysis: response.choices[0]?.message?.content ?? "",
        detail,
        tokensUsed: response.usage?.total_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const imageAnalyzerTool: ToolDefinition = {
  name: "analyze_image",
  description: "Analyze images from URLs using AI vision. Can read text in images (OCR), identify objects and scenes, describe layouts, analyze charts/graphs, read handwriting, and answer specific questions about image content.",
  parameters: {
    imageUrl: {
      type: "string",
      description: "Public URL of the image to analyze (must start with http:// or https://)",
      required: true,
    },
    question: {
      type: "string",
      description: "Specific question about the image (e.g., 'What text is in this image?', 'Describe the chart data'). Leave empty for full description.",
      required: false,
    },
    detail: {
      type: "string",
      description: "Analysis detail level: 'low' (faster, cheaper) or 'high' (more detailed, better for small text). Default: 'high'",
      required: false,
    },
  },
  execute: async (params) => {
    const detail = String(params.detail ?? "high") === "low" ? "low" : "high";
    return analyzeImage(
      String(params.imageUrl),
      String(params.question ?? ""),
      detail
    );
  },
};
