export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ParameterDefinition {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  items?: { type: string };
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
}

export interface AgentStep {
  thought: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: ToolResult;
  observation: string;
}

export interface AgentContext {
  sessionId: string;
  taskId: string;
  goal: string;
  steps: AgentStep[];
  memory: Record<string, string>;
}
