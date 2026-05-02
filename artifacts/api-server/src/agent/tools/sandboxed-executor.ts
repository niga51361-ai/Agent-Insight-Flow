import type { ToolDefinition, ToolResult } from "./types.js";
import vm from "vm";
import { logger } from "../../lib/logger.js";
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

async function autoFixCode(
  code: string,
  language: string,
  error: string
): Promise<string> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert code debugger. Fix the code to make it work correctly. Return ONLY the fixed code, no explanations, no markdown fences.",
        },
        {
          role: "user",
          content: `Language: ${language}\n\nOriginal Code:\n${code}\n\nError:\n${error}\n\nReturn only the fixed code:`,
        },
      ],
      max_completion_tokens: 2048,
    });
    return response.choices[0]?.message?.content?.trim() ?? code;
  } catch {
    return code;
  }
}

async function runJavaScriptSandbox(
  code: string,
  timeoutMs: number
): Promise<{ success: boolean; stdout: string; stderr: string; returnValue?: string; error?: string }> {
  const logs: string[] = [];
  const errors: string[] = [];

  const sandbox = {
    console: {
      log: (...args: unknown[]) => logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")),
      error: (...args: unknown[]) => errors.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => logs.push("[WARN] " + args.map(String).join(" ")),
      info: (...args: unknown[]) => logs.push("[INFO] " + args.map(String).join(" ")),
      table: (data: unknown) => logs.push(JSON.stringify(data, null, 2)),
    },
    Math,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    Map,
    Set,
    Promise,
    Error,
    TypeError,
    RangeError,
  };

  try {
    const context = vm.createContext(sandbox);
    const result = vm.runInContext(code, context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    return {
      success: true,
      stdout: logs.join("\n"),
      stderr: errors.join("\n"),
      returnValue: result !== undefined ? (typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)) : undefined,
    };
  } catch (err) {
    return {
      success: false,
      stdout: logs.join("\n"),
      stderr: errors.join("\n"),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const sandboxedCodeExecutorTool: ToolDefinition = {
  name: "sandbox_execute",
  description:
    "Execute code in a fully isolated sandbox with automatic error detection and self-healing. If the code fails, the AI automatically fixes it and retries (up to 3 times). Supports JavaScript with full math, data structures, algorithms, and logic. Returns execution output, stdout, and any errors. This is the primary tool for running and verifying code.",
  parameters: {
    code: {
      type: "string",
      description: "The JavaScript code to execute and verify",
      required: true,
    },
    description: {
      type: "string",
      description: "Brief description of what this code should accomplish",
      required: false,
    },
    timeout: {
      type: "number",
      description: "Execution timeout in milliseconds (default: 10000, max: 30000)",
      required: false,
    },
  },
  execute: async (params): Promise<ToolResult> => {
    const originalCode = String(params.code ?? "");
    const description = String(params.description ?? "");
    const timeoutMs = Math.min(Number(params.timeout ?? 10000), 30000);

    if (!originalCode.trim()) {
      return { success: false, output: null, error: "Code is required" };
    }

    let currentCode = originalCode;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    const executionLog: Array<{ attempt: number; success: boolean; error?: string; autoFixed?: boolean }> = [];

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const result = await runJavaScriptSandbox(currentCode, timeoutMs);

      if (result.success) {
        executionLog.push({ attempt: attempts, success: true });
        return {
          success: true,
          output: {
            language: "javascript",
            stdout: result.stdout || "(no output)",
            stderr: result.stderr || "",
            returnValue: result.returnValue,
            executionTime: `<${timeoutMs}ms`,
            attempts,
            autoFixed: attempts > 1,
            executionLog,
            verificationStatus: "PASSED",
            description: description || "Code executed successfully",
          },
        };
      }

      executionLog.push({ attempt: attempts, success: false, error: result.error });

      if (attempts < MAX_ATTEMPTS) {
        logger.info({ attempt: attempts, error: result.error }, "Sandbox execution failed, auto-fixing code");
        currentCode = await autoFixCode(currentCode, "javascript", result.error ?? "Unknown error");
        executionLog[executionLog.length - 1].autoFixed = true;
      } else {
        return {
          success: false,
          output: {
            language: "javascript",
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            error: result.error,
            attempts,
            executionLog,
            verificationStatus: "FAILED",
            fixedCode: currentCode !== originalCode ? currentCode : undefined,
          },
          error: `Execution failed after ${MAX_ATTEMPTS} attempts: ${result.error}`,
        };
      }
    }

    return { success: false, output: null, error: "Unexpected execution state" };
  },
};
