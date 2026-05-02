import type { ToolDefinition, ToolResult } from "./types.js";
import OpenAI from "openai";
import { deductCredits } from "@workspace/db";

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

async function generateCode(
  userId: string,
  description: string,
  language: string,
  context?: string
): Promise<ToolResult> {
  try {
    const systemPrompt = `You are an expert ${language} developer. Generate clean, production-ready code based on the description. 
Return ONLY the code without any markdown formatting or explanations unless asked.
If the code is a complete file, include all necessary imports and exports.`;

    const userPrompt = context
      ? `Description: ${description}\n\nContext/Additional info:\n${context}`
      : `Description: ${description}`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 4096,
    });

    const code = response.choices[0]?.message?.content ?? "";

    let cleanCode = code
      .replace(/^```[\w]*\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    return {
      success: true,
      output: {
        language,
        description,
        code: cleanCode,
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

export const codeWriterTool: ToolDefinition = {
  name: "write_code",
  description:
    "Generate code in any programming language based on a description. Can create complete files, functions, components, or scripts.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    description: {
      type: "string",
      description: "Detailed description of what the code should do",
      required: true,
    },
    language: {
      type: "string",
      description:
        "Programming language (e.g., TypeScript, Python, HTML, CSS, React, SQL)",
      required: true,
    },
    context: {
      type: "string",
      description: "Optional additional context, existing code, or requirements",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId); // Assuming userId is passed as a parameter to the tool
    return generateCode(
      userId,
      String(params.description),
      String(params.language),
      params.context ? String(params.context) : undefined
    );
  },
};
