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

async function generateImage(
  prompt: string,
  size: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024",
  quality: "standard" | "hd" = "standard"
): Promise<ToolResult> {
  try {
    const response = await getOpenAI().images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      return { success: false, output: null, error: "No image data returned" };
    }

    // gpt-image-1 always returns base64
    const b64 = imageData.b64_json;
    if (!b64) {
      return { success: false, output: null, error: "No base64 image data" };
    }

    return {
      success: true,
      output: {
        imageUrl: `data:image/png;base64,${b64}`,
        b64,
        prompt,
        size,
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

export const imageGeneratorTool: ToolDefinition = {
  name: "generate_image",
  description:
    "Generate high-quality images using AI. Use when the user asks for an image, illustration, diagram visual, or when explaining a concept that would benefit from a visual illustration. Returns a base64 image that will be displayed inline in the chat.",
  parameters: {
    prompt: {
      type: "string",
      description:
        "Detailed description of the image to generate. Be specific about style, colors, composition, subject matter. For educational content, describe what should be illustrated clearly.",
      required: true,
    },
    size: {
      type: "string",
      description:
        "Image size: '1024x1024' (square, default), '1536x1024' (landscape/wide), '1024x1536' (portrait/tall)",
      required: false,
    },
  },
  execute: async (params) => {
    const prompt = String(params.prompt);
    const rawSize = String(params.size ?? "1024x1024");
    const size: "1024x1024" | "1536x1024" | "1024x1536" =
      rawSize === "1536x1024" ? "1536x1024" :
      rawSize === "1024x1536" ? "1024x1536" : "1024x1024";
    return generateImage(prompt, size);
  },
};
