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

async function debugCode(
  userId: string,
  code: string,
  language: string,
  errorMessage: string | undefined,
  task: string,
  agentPersonality?: AgentPersonality
): Promise<ToolResult> {
  try {
    const LLM_COST_PER_TOKEN = 0.000003; // Example cost, adjust as needed
    const estimatedTokens = Math.ceil((code.length + (errorMessage?.length || 0) + task.length) / 4); // Rough estimate
    const cost = estimatedTokens * LLM_COST_PER_TOKEN;

    const creditsDeducted = await deductCredits(userId, cost, `Code debugging (${language})`);
    if (!creditsDeducted) {
      return { success: false, output: null, error: "Insufficient credits for code debugging." };
    }

    const agentName = agentPersonality?.name || "Zanix AI";
    const agentDescription = agentPersonality?.description || "an expert software engineer and debugger";
    const agentTone = agentPersonality?.tone || "precise and thorough";

    const systemPrompt = `You are ${agentName}, ${agentDescription}. Your tone is ${agentTone}.
Specializing in ${language}.
Your tasks:
1. Identify ALL bugs, logic errors, security vulnerabilities, and code smells
2. Explain each issue clearly
3. Provide the COMPLETE fixed code
4. List improvements and best practices applied

Return a JSON object:
{
  "issues": [{"type": "bug|security|performance|style", "line": number_or_null, "description": "...", "severity": "critical|high|medium|low"}],
  "fixedCode": "complete corrected code here",
  "changes": ["list of changes made"],
  "explanation": "brief explanation of main fixes",
  "qualityScore": 0-100
}`;

    const userContent = `Language: ${language}
Task the code should perform: ${task}
${errorMessage ? `Error message:\n${errorMessage}\n` : ""}
Code to debug:
\`\`\`${language}
${code.substring(0, 8000)}
\`\`\``;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: {
      issues?: Array<{ type: string; line?: number; description: string; severity: string }>;
      fixedCode?: string;
      changes?: string[];
      explanation?: string;
      qualityScore?: number;
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { explanation: content, fixedCode: code };
    }

    return {
      success: true,
      output: {
        language,
        originalCode: code.substring(0, 500) + (code.length > 500 ? "..." : ""),
        issues: parsed.issues ?? [],
        issueCount: (parsed.issues ?? []).length,
        criticalIssues: (parsed.issues ?? []).filter((i) => i.severity === "critical").length,
        fixedCode: parsed.fixedCode ?? code,
        changes: parsed.changes ?? [],
        explanation: parsed.explanation ?? "",
        qualityScore: parsed.qualityScore ?? null,
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

export const codeDebuggerTool: ToolDefinition = {
  name: "debug_code",
  description:
    "Analyze code for bugs, errors, security vulnerabilities, and performance issues. Provides detailed explanation of problems and returns the complete fixed code. Use when code has errors or needs review.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    code: {
      type: "string",
      description: "The code to debug and fix",
      required: true,
    },
    language: {
      type: "string",
      description: "Programming language (e.g., TypeScript, Python, JavaScript, SQL, Rust)",
      required: true,
    },
    errorMessage: {
      type: "string",
      description: "The error message or stack trace (if any)",
      required: false,
    },
    task: {
      type: "string",
      description: "What the code is supposed to do (helps with logic debugging)",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const agentPersonality = await getAgentPersonality(userId);
    return debugCode(
      userId,
      String(params.code),
      String(params.language),
      params.errorMessage ? String(params.errorMessage) : undefined,
      String(params.task ?? "Not specified"),
      agentPersonality
    );
  },
};
