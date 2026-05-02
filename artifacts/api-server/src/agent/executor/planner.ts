import OpenAI from "openai";
import type { ToolRegistry } from "../tools/registry.js";

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

export interface PlanStep {
  stepNumber: number;
  action: string;
  tool?: string;
  reasoning: string;
  expectedOutput: string;
}

export interface ExecutionPlan {
  goal: string;
  steps: PlanStep[];
  estimatedComplexity: "simple" | "moderate" | "complex";
  notes: string;
}

export async function createPlan(
  goal: string,
  registry: ToolRegistry,
  memory: Record<string, string> = {}
): Promise<ExecutionPlan> {
  const toolNames = registry.names().join(", ");
  const memoryContext = Object.keys(memory).length > 0
    ? `\nAvailable memory/context:\n${JSON.stringify(memory, null, 2)}`
    : "";

  const systemPrompt = `You are an expert AI agent planner. Create a concise execution plan for the given goal.
Available tools: ${toolNames}

Return a JSON object with this structure:
{
  "goal": "...",
  "steps": [
    {
      "stepNumber": 1,
      "action": "What to do",
      "tool": "tool_name_or_null",
      "reasoning": "Why this step",
      "expectedOutput": "What this produces"
    }
  ],
  "estimatedComplexity": "simple|moderate|complex",
  "notes": "Any important notes about execution"
}

Keep the plan focused and efficient. Maximum 8 steps for complex tasks, 3-5 for most tasks.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Create an execution plan for this goal: ${goal}${memoryContext}`,
      },
    ],
    max_completion_tokens: 1024,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as ExecutionPlan;
  } catch {
    return {
      goal,
      steps: [{ stepNumber: 1, action: goal, tool: undefined, reasoning: "Direct execution", expectedOutput: "Result" }],
      estimatedComplexity: "simple",
      notes: "Fallback plan",
    };
  }
}
