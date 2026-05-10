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

async function generateCode(
  description: string,
  language: string,
  context?: string
): Promise<ToolResult> {
  try {
    const systemPrompt = `You are an expert ${language} developer. Generate clean, production-ready, fully working code.
Rules:
- Return ONLY the code — no markdown fences, no explanations, no comments unless in the code itself.
- Include all necessary imports and exports.
- Handle errors appropriately.
- Use modern syntax and best practices for ${language}.`;

    const userPrompt = context
      ? `Description: ${description}\n\nContext/Requirements:\n${context}`
      : `Description: ${description}`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 4096,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const code = raw
      .replace(/^```[\w]*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();

    return {
      success: true,
      output: {
        language,
        description,
        code,
        lines: code.split("\n").length,
        tokensUsed: response.usage?.total_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const codeWriterTool: ToolDefinition = {
  name: "write_code",
  description: "Generate production-ready code in any programming language from a natural language description. Can create complete files, functions, React components, APIs, scripts, or any code. Returns the raw code without markdown fencing.",
  parameters: {
    description: {
      type: "string",
      description: "Detailed description of what the code should do",
      required: true,
    },
    language: {
      type: "string",
      description: "Programming language (e.g., TypeScript, Python, JavaScript, Rust, Go, HTML, CSS, SQL, React, Vue)",
      required: true,
    },
    context: {
      type: "string",
      description: "Optional additional context — existing code, project requirements, or constraints",
      required: false,
    },
  },
  execute: async (params) => {
    return generateCode(
      String(params.description),
      String(params.language),
      params.context ? String(params.context) : undefined
    );
  },
};
