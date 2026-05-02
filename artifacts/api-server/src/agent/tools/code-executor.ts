import type { ToolDefinition, ToolResult } from "./types.js";
import { spawn } from "child_process";
import vm from "vm";
import fs from "fs";
import { deductCredits } from "@workspace/db";


async function executeJavaScript(userId: string, code: string, timeoutMs: number): Promise<ToolResult> {
  const JS_EXECUTION_COST = 0.001; // Example cost
  const creditsDeducted = await deductCredits(userId, JS_EXECUTION_COST, "JavaScript execution");
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for JavaScript execution." };
  }

  return new Promise((resolve) => {
    const logs: string[] = [];
    const errors: string[] = [];

    const sandbox = {
      console: {
        log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
        error: (...args: unknown[]) => errors.push(args.map(String).join(" ")),
        warn: (...args: unknown[]) => logs.push("[WARN] " + args.map(String).join(" ")),
        info: (...args: unknown[]) => logs.push("[INFO] " + args.map(String).join(" ")),
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
      setTimeout: undefined,
      setInterval: undefined,
      fetch: undefined,
      require: undefined,
      process: undefined,
      __dirname: undefined,
      __filename: undefined,
      global: undefined,
    };

    try {
      const context = vm.createContext(sandbox);
      const result = vm.runInContext(code, context, {
        timeout: timeoutMs,
        displayErrors: true,
      });

      resolve({
        success: true,
        output: {
          language: "javascript",
          stdout: logs.join("\n"),
          stderr: errors.join("\n"),
          returnValue: result !== undefined ? String(result) : undefined,
          executionTime: `<${timeoutMs}ms`,
        },
      });
    } catch (err) {
      resolve({
        success: false,
        output: {
          language: "javascript",
          stdout: logs.join("\n"),
          stderr: errors.join("\n"),
          error: err instanceof Error ? err.message : String(err),
        },
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

async function executePythonInDocker(userId: string, code: string, timeoutMs: number): Promise<ToolResult> {
  const PYTHON_EXECUTION_COST = 0.002; // Example cost
  const creditsDeducted = await deductCredits(userId, PYTHON_EXECUTION_COST, "Python execution");
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for Python execution." };
  }

  const containerName = `python-executor-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const tempFileName = `/tmp/${containerName}.py`;

  // Write the Python code to a temporary file
  await fs.promises.writeFile(tempFileName, code);

  const dockerCommand = [
    "docker", "run", "--rm",
    "--name", containerName,
    "-v", `${tempFileName}:/app/script.py:ro`,
    "python:3.10-slim", "python", "/app/script.py"
  ];

  return new Promise((resolve) => {
    const startTime = Date.now();

    let stdout = "";
    let stderr = "";

    const child = spawn(dockerCommand[0], dockerCommand.slice(1), {
      timeout: timeoutMs,
    });

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > 50000) {
        child.kill();
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", async (code) => {
      const elapsed = Date.now() - startTime;
      // Clean up the temporary file
      await fs.promises.unlink(tempFileName);
      if (code === 0) {
        resolve({
          success: true,
          output: {
            language: "python",
            stdout: stdout.substring(0, 10000),
            stderr: stderr.substring(0, 2000),
            exitCode: code,
            executionTime: `${elapsed}ms`,
          },
        });
      } else {
        resolve({
          success: false,
          output: {
            language: "python",
            stdout: stdout.substring(0, 5000),
            stderr: stderr.substring(0, 5000),
            exitCode: code,
            executionTime: `${elapsed}ms`,
          },
          error: stderr.substring(0, 500) || "Python execution failed",
        });
      }
    });

    child.on("error", async (err) => {
      // Clean up the temporary file in case of spawn error
      await fs.promises.unlink(tempFileName);
      resolve({
        success: false,
        output: null,
        error: err.message.includes("ENOENT")
          ? "Docker or Python is not available in this environment, or an internal error occurred."
          : err.message,
      });
    });
  });
}

export const codeExecutorTool: ToolDefinition = {
  name: "execute_code",
  description:
    "Execute code in a safe sandbox environment. Supports JavaScript (with math, array, string operations) and Python (for data processing, calculations, algorithms). Returns stdout output and any errors. Use this to run, test, and verify code logic.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },

    code: {
      type: "string",
      description: "The code to execute",
      required: true,
    },
    language: {
      type: "string",
      description: "Programming language: 'javascript' or 'python'",
      required: true,
    },
    timeout: {
      type: "number",
      description: "Execution timeout in milliseconds (default: 10000, max: 30000)",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const lang = String(params.language).toLowerCase();
    const code = String(params.code);
    const timeout = Math.min(Number(params.timeout ?? 10000), 30000);

    if (lang === "javascript" || lang === "js") {
      return executeJavaScript(userId, code, timeout);
    } else if (lang === "python" || lang === "py") {
      return executePythonInDocker(userId, code, timeout);
    } else {
      return {
        success: false,
        output: null,
        error: `Unsupported language: ${lang}. Use 'javascript' or 'python'.`,
      };
    }
  },
};
