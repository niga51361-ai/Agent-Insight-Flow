import type { ToolDefinition, ToolResult } from "./types.js";

function safeEval(expression: string): ToolResult {
  try {
    const sanitized = expression
      .replace(/[^0-9+\-*/().%^,\s]/g, "")
      .trim();

    if (!sanitized) {
      return { success: false, output: null, error: "Invalid expression" };
    }

    const result = Function(`"use strict"; return (${sanitized})`)();

    if (typeof result !== "number" || !isFinite(result)) {
      return { success: false, output: null, error: "Expression did not produce a valid number" };
    }

    return {
      success: true,
      output: {
        expression,
        result,
        formatted: result.toLocaleString("en-US", { maximumFractionDigits: 10 }),
      },
    };
  } catch (err) {
    return {
      success: false,
      output: null,
      error: err instanceof Error ? err.message : "Invalid mathematical expression",
    };
  }
}

export const calculatorTool: ToolDefinition = {
  name: "calculate",
  description:
    "Perform mathematical calculations. Supports basic arithmetic (+, -, *, /), parentheses, percentages, and exponentiation. Use for accurate numerical computations.",
  parameters: {
    expression: {
      type: "string",
      description: "Mathematical expression to evaluate (e.g., '2 + 2', '(10 * 5) / 2', '15%')",
      required: true,
    },
  },
  execute: async (params) => {
    return safeEval(String(params.expression));
  },
};
