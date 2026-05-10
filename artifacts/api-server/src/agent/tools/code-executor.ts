import type { ToolDefinition, ToolResult } from "./types.js";
import { spawn } from "child_process";
import vm from "vm";
import fs from "fs";
import os from "os";
import path from "path";

async function executeJavaScript(code: string, timeoutMs: number): Promise<ToolResult> {
  const logs: string[] = [];
  const errors: string[] = [];

  const sandbox = {
    console: {
      log: (...args: unknown[]) => logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")),
      error: (...args: unknown[]) => errors.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => logs.push("[WARN] " + args.map(String).join(" ")),
      info: (...args: unknown[]) => logs.push("[INFO] " + args.map(String).join(" ")),
      table: (d: unknown) => logs.push(JSON.stringify(d, null, 2)),
    },
    Math, JSON, parseInt, parseFloat, isNaN, isFinite,
    Array, Object, String, Number, Boolean, Date, RegExp,
    Map, Set, Promise, Error, TypeError, RangeError,
    encodeURIComponent, decodeURIComponent,
  };

  return new Promise((resolve) => {
    try {
      const context = vm.createContext(sandbox);
      const result = vm.runInContext(code, context, { timeout: timeoutMs, displayErrors: true });
      resolve({
        success: true,
        output: {
          language: "javascript",
          stdout: logs.join("\n") || "(no output)",
          stderr: errors.join("\n"),
          returnValue: result !== undefined ? (typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)) : undefined,
          executionTime: `<${timeoutMs}ms`,
        },
      });
    } catch (err) {
      resolve({
        success: false,
        output: { language: "javascript", stdout: logs.join("\n"), stderr: errors.join("\n") },
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

async function executePython(code: string, timeoutMs: number): Promise<ToolResult> {
  const tmpFile = path.join(os.tmpdir(), `zanix_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
  await fs.promises.writeFile(tmpFile, code, "utf8");

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let killed = false;

    const child = spawn("python3", [tmpFile], {
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); if (stdout.length > 50000) { killed = true; child.kill(); } });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", async (code) => {
      clearTimeout(timer);
      await fs.promises.unlink(tmpFile).catch(() => {});
      const elapsed = Date.now() - startTime;
      if (killed && stdout.length > 50000) {
        resolve({ success: false, output: { language: "python", stdout: stdout.slice(0, 5000), stderr }, error: "Output exceeded 50KB limit" });
        return;
      }
      if (killed) {
        resolve({ success: false, output: { language: "python", stdout: stdout.slice(0, 5000), stderr }, error: `Execution timed out after ${timeoutMs}ms` });
        return;
      }
      if (code === 0) {
        resolve({ success: true, output: { language: "python", stdout: stdout.slice(0, 10000) || "(no output)", stderr: stderr.slice(0, 2000), exitCode: 0, executionTime: `${elapsed}ms` } });
      } else {
        resolve({ success: false, output: { language: "python", stdout: stdout.slice(0, 5000), stderr: stderr.slice(0, 5000), exitCode: code, executionTime: `${elapsed}ms` }, error: stderr.slice(0, 500) || "Execution failed" });
      }
    });

    child.on("error", async (err) => {
      clearTimeout(timer);
      await fs.promises.unlink(tmpFile).catch(() => {});
      if (err.message.includes("ENOENT")) {
        resolve({ success: false, output: null, error: "python3 not found. Install it with: apt-get install python3" });
      } else {
        resolve({ success: false, output: null, error: err.message });
      }
    });
  });
}

export const codeExecutorTool: ToolDefinition = {
  name: "execute_code",
  description: "Execute code in a real runtime environment. JavaScript runs in a secure Node.js VM sandbox. Python runs with python3 directly. Returns actual stdout, stderr, and execution results. Use to verify code logic, run calculations, process data, or test algorithms.",
  parameters: {
    code:     { type: "string", description: "The code to execute", required: true },
    language: { type: "string", description: "Programming language: 'javascript' or 'python'", required: true },
    timeout:  { type: "number", description: "Execution timeout in ms (default: 10000, max: 30000)", required: false },
  },
  execute: async (params) => {
    const lang    = String(params.language ?? "javascript").toLowerCase();
    const code    = String(params.code ?? "");
    const timeout = Math.min(Number(params.timeout ?? 10000), 30000);
    if (!code.trim()) return { success: false, output: null, error: "Code cannot be empty." };
    if (lang === "javascript" || lang === "js") return executeJavaScript(code, timeout);
    if (lang === "python"     || lang === "py") return executePython(code, timeout);
    return { success: false, output: null, error: `Unsupported language: "${lang}". Use 'javascript' or 'python'.` };
  },
};
