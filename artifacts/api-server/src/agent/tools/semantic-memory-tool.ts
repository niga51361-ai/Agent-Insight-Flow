import type { ToolDefinition, ToolResult } from "./types.js";
import { SemanticMemoryManager } from "../memory/semantic-memory.js";

export function createSemanticMemoryTool(sessionId: string): ToolDefinition {
  return {
    name: "semantic_memory_search",
    description:
      "Search past memories and stored information using natural language semantic similarity. Unlike keyword search, this understands meaning and context. Use this to find relevant memories even when you don't know the exact key. Example: searching 'user's old project' will find memories about any previously mentioned projects.",
    parameters: {
      query: {
        type: "string",
        description: "Natural language query to search memories semantically",
        required: true,
      },
      topK: {
        type: "number",
        description: "Maximum number of results to return (default: 5)",
        required: false,
      },
      threshold: {
        type: "number",
        description: "Similarity threshold 0-1 (default: 0.6 — lower means more results)",
        required: false,
      },
    },
    execute: async (params): Promise<ToolResult> => {
      const query = String(params.query ?? "");
      const topK = Math.min(Number(params.topK ?? 5), 20);
      const threshold = Math.max(0.1, Math.min(1.0, Number(params.threshold ?? 0.6)));

      if (!query.trim()) {
        return { success: false, output: null, error: "Query is required" };
      }

      const manager = new SemanticMemoryManager(sessionId);
      const results = await manager.semanticSearch(query, topK, threshold);

      if (results.length === 0) {
        return {
          success: true,
          output: {
            found: 0,
            query,
            results: [],
            message: "No semantically similar memories found. Try a broader query or lower threshold.",
          },
        };
      }

      return {
        success: true,
        output: {
          found: results.length,
          query,
          results: results.map((r) => ({
            key: r.key,
            value: r.value,
            type: r.memoryType,
            relevance: `${(r.similarity * 100).toFixed(1)}%`,
          })),
        },
      };
    },
  };
}

export function createSemanticStoreMemoryTool(sessionId: string): ToolDefinition {
  return {
    name: "store_memory_semantic",
    description:
      "Store information in semantic memory with vector embeddings for intelligent future retrieval. Unlike key-value memory, this stores information that can be found by meaning, not just by exact key. Use for: project details, user preferences, research findings, important context.",
    parameters: {
      key: {
        type: "string",
        description: "A descriptive key/name for this memory",
        required: true,
      },
      value: {
        type: "string",
        description: "The information to store (can be detailed text)",
        required: true,
      },
      memoryType: {
        type: "string",
        description: "Type: 'fact', 'project', 'preference', 'finding', 'context'",
        required: false,
      },
    },
    execute: async (params): Promise<ToolResult> => {
      const key = String(params.key ?? "");
      const value = String(params.value ?? "");
      const memoryType = String(params.memoryType ?? "fact");

      if (!key.trim() || !value.trim()) {
        return { success: false, output: null, error: "Key and value are required" };
      }

      const manager = new SemanticMemoryManager(sessionId);
      await manager.store(key, value, memoryType);

      return {
        success: true,
        output: {
          stored: true,
          key,
          memoryType,
          message: `Stored '${key}' in semantic memory with vector embedding for intelligent retrieval.`,
        },
      };
    },
  };
}
