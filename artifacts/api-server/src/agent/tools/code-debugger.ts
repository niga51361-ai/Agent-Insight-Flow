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

async function debugCode(
  code: string,
  language: string,
  errorMessage: string | undefined,
  task: string
): Promise<ToolResult> {
  try {
    const systemPrompt = `You are an expert ${language} debugger and code reviewer — Zanix AI's debugging engine.

Your tasks:
1. Identify ALL bugs, logic errors, security vulnerabilities, and code smells
2. Explain each issue clearly with line numbers when possible
3. Provide the COMPLETE fixed code (not just the changed parts)
4. List all improvements applied
5. Give a code quality score 0-100

Return ONLY valid JSON matching this schema exactly:
{
  "issues": [{"type": "bug|security|performance|style", "line": null_or_number, "description": "...", "severity": "critical|high|medium|low"}],
  "fixedCode": "complete corrected code here",
  "changes": ["list of changes made"],
  "explanation": "brief explanation of main fixes",
  "qualityScore": 0
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
      issues?: Array<{ type: string; line?: number | null; description: string; severity: string }>;
      fixedCode?: string;
      changes?: string[];
      explanation?: string;
      qualityScore?: number;
    };

    try { parsed = JSON.parse(content); }
    catch { parsed = { explanation: content, fixedCode: code }; }

    return {
      success: true,
      output: {
        language,
        originalCodePreview: code.substring(0, 300) + (code.length > 300 ? "..." : ""),
        issues: parsed.issues ?? [],
        issueCount: (parsed.issues ?? []).length,
        criticalIssues: (parsed.issues ?? []).filter(i => i.severity === "critical").length,
        highIssues: (parsed.issues ?? []).filter(i => i.severity === "high").length,
        fixedCode: parsed.fixedCode ?? code,
        changes: parsed.changes ?? [],
        explanation: parsed.explanation ?? "",
        qualityScore: parsed.qualityScore ?? null,
        tokensUsed: response.usage?.total_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const codeDebuggerTool: ToolDefinition = {
  name: "debug_code",
  description: "Deeply analyze code for bugs, errors, security vulnerabilities, and performance issues. Provides a detailed issue report, severity ratings, full fixed code, and quality score. Use when code has errors or needs review.",
  parameters: {
    code:         { type: "string", description: "The code to debug and fix", required: true },
    language:     { type: "string", description: "Programming language (e.g., TypeScript, Python, JavaScript, SQL, Rust)", required: true },
    errorMessage: { type: "string", description: "The error message or stack trace if available", required: false },
    task:         { type: "string", description: "What the code is supposed to accomplish (helps with logic debugging)", required: false },
  },
  execute: async (params) => {
    return debugCode(
      String(params.code),
      String(params.language),
      params.errorMessage ? String(params.errorMessage) : undefined,
      String(params.task ?? "Not specified")
    );
  },
};
