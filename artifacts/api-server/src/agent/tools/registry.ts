import type { ToolDefinition } from "./types.js";
import { webSearchTool } from "./web-search.js";
import { browseWebTool } from "./browse-web.js";
import { codeWriterTool } from "./code-writer.js";
import { websiteBuilderTool } from "./website-builder.js";
import { textSummarizerTool } from "./text-summarizer.js";
import { saveFileTool, listFilesTool } from "./file-manager.js";
import { calculatorTool } from "./calculator.js";
import { dataAnalyzerTool } from "./data-analyzer.js";
import { translatorTool } from "./translator.js";
import { codeExecutorTool } from "./code-executor.js";
import { httpClientTool } from "./http-client.js";
import { realtimeDataTool } from "./realtime-data.js";
import { imageAnalyzerTool } from "./image-analyzer.js";
import { structuredDataTool } from "./structured-data.js";
import { diagramGeneratorTool } from "./diagram-generator.js";
import { documentWriterTool } from "./document-writer.js";
import { codeDebuggerTool } from "./code-debugger.js";
import { memoryStoreTool, memorySearchTool } from "./memory-search.js";
import { spawnAgentsTool } from "./spawn-agents.js";
import { IntegrationManagerTool } from "./integration-manager.js";
import { GitHubTool } from "./github-tool.js";
import { GoogleDriveTool } from "./google-drive-tool.js";
import { SlackTool } from "./slack-tool.js";
import { NotionTool } from "./notion-tool.js";
import { sandboxedCodeExecutorTool } from "./sandboxed-executor.js";
import { createSemanticMemoryTool, createSemanticStoreMemoryTool } from "./semantic-memory-tool.js";

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  toOpenAIFormat(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  }> {
    return this.getAll().map((tool) => {
      const params = tool.parameters ?? {};

      const required = Object.entries(params)
        .filter(([, def]) => def.required)
        .map(([name]) => name);

      const properties: Record<string, unknown> = {};
      for (const [paramName, paramDef] of Object.entries(params)) {
        properties[paramName] = {
          type: paramDef.type,
          description: paramDef.description,
          ...(paramDef.items ? { items: paramDef.items } : {}),
        };
      }

      return {
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: "object",
            properties,
            required,
          },
        },
      };
    });
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }
}

export function createDefaultRegistry(sessionId?: string): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(webSearchTool);
  registry.register(browseWebTool);
  registry.register(codeWriterTool);
  registry.register(codeExecutorTool);
  registry.register(codeDebuggerTool);
  registry.register(sandboxedCodeExecutorTool);
  registry.register(websiteBuilderTool);
  registry.register(textSummarizerTool);
  registry.register(saveFileTool);
  registry.register(listFilesTool);
  registry.register(calculatorTool);
  registry.register(dataAnalyzerTool);
  registry.register(translatorTool);
  registry.register(httpClientTool);
  registry.register(realtimeDataTool);
  registry.register(imageAnalyzerTool);
  registry.register(structuredDataTool);
  registry.register(diagramGeneratorTool);
  registry.register(documentWriterTool);
  registry.register(memoryStoreTool);
  registry.register(memorySearchTool);
  registry.register(spawnAgentsTool);
  registry.register(new IntegrationManagerTool());
  registry.register(new GitHubTool());
  registry.register(new GoogleDriveTool());
  registry.register(new SlackTool());
  registry.register(new NotionTool());

  if (sessionId) {
    registry.register(createSemanticMemoryTool(sessionId));
    registry.register(createSemanticStoreMemoryTool(sessionId));
  }

  return registry;
}
