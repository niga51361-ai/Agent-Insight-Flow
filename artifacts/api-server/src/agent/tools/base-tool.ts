export abstract class BaseTool {
  abstract name: string;
  abstract description: string;

  protected abstract onCall(input: Record<string, unknown>): Promise<unknown>;

  async execute(input: Record<string, unknown>): Promise<{ success: boolean; output: unknown; error?: string }> {
    try {
      const output = await this.onCall(input);
      return { success: true, output };
    } catch (err) {
      return {
        success: false,
        output: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  toOpenAIFunction(): {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: { type: string; properties: Record<string, unknown>; required: string[] };
    };
  } {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: { type: "object", properties: {}, required: [] },
      },
    };
  }
}
