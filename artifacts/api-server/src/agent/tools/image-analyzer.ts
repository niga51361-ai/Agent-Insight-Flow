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

async function analyzeImage(
  userId: string,
  imageUrl: string,
  question: string,
  detail: "low" | "high",
  agentPersonality?: AgentPersonality
): Promise<ToolResult> {
  const IMAGE_ANALYSIS_COST = detail === "high" ? 0.005 : 0.001; // Example cost
  const creditsDeducted = await deductCredits(userId, IMAGE_ANALYSIS_COST, `Image analysis (${detail} detail)`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for image analysis." };
  }

  try {
    new URL(imageUrl);
  } catch {
    return { success: false, output: null, error: "Invalid image URL" };
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
              image_url: {
                url: imageUrl,
                detail,
              },
            },
            {
              type: "text",
              text: question || "Describe this image in detail. Extract all text visible, identify objects, colors, layout, and any notable features.",
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
        question,
        analysis: response.choices[0]?.message?.content ?? "",
        detail,
        tokensUsed: response.usage?.total_tokens ?? 0,
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

export const imageAnalyzerTool: ToolDefinition = {
  name: "analyze_image",
  description:
    "Analyze images from URLs using AI vision. Can read text in images (OCR), identify objects and scenes, describe layouts, analyze charts/graphs, and answer specific questions about the image content.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    imageUrl: {
      type: "string",
      description: "Public URL of the image to analyze",
      required: true,
    },
    question: {
      type: "string",
      description:
        "Specific question about the image (e.g., 'What text is in this image?', 'Describe the chart data', 'What objects are visible?'). Leave empty for a full description.",
      required: false,
    },
    detail: {
      type: "string",
      description: "Analysis detail level: 'low' (faster) or 'high' (more detailed). Default: 'high'",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const agentPersonality = await getAgentPersonality(userId);
    const detail = String(params.detail ?? "high") === "low" ? "low" : "high";
    return analyzeImage(
      userId,
      String(params.imageUrl),
      String(params.question ?? ""),
      detail,
      agentPersonality
    );
  },
};
