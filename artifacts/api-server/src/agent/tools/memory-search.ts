import type { ToolDefinition, ToolResult } from "./types.js";
import { db } from "@workspace/db";
import { agentMemoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text.substring(0, 8000),
  });
  return response.data[0]?.embedding ?? [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

async function storeMemory(
  sessionId: string,
  key: string,
  value: string,
  memoryType: string
): Promise<ToolResult> {
  try {
    let embedding: number[] = [];
    try { embedding = await generateEmbedding(value); } catch {}

    await db
      .insert(agentMemoryTable)
      .values({ sessionId, memoryType, key, value, embedding: embedding.length ? embedding : null })
      .onConflictDoNothing();

    return {
      success: true,
      output: { stored: true, key, memoryType, sessionId, hasEmbedding: embedding.length > 0 },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function searchMemory(sessionId: string, query: string): Promise<ToolResult> {
  try {
    const allMemories = await db
      .select()
      .from(agentMemoryTable)
      .where(eq(agentMemoryTable.sessionId, sessionId))
      .limit(100);

    if (allMemories.length === 0) {
      return { success: true, output: { results: [], message: "No memories stored in this session yet." } };
    }

    // Try vector search first, fall back to keyword search
    let results: Array<{ key: string; value: string; memoryType: string; relevanceScore: number }>;

    const memoriesWithEmbeddings = allMemories.filter(m => Array.isArray(m.embedding) && (m.embedding as number[]).length > 0);

    if (memoriesWithEmbeddings.length > 0) {
      let queryEmbedding: number[] = [];
      try { queryEmbedding = await generateEmbedding(query); } catch {}

      if (queryEmbedding.length > 0) {
        const withScores = memoriesWithEmbeddings.map(m => ({
          ...m,
          score: cosineSimilarity(queryEmbedding, m.embedding as number[]),
        })).sort((a, b) => b.score - a.score).slice(0, 5);

        results = withScores.map(m => ({
          key: m.key,
          value: m.value,
          memoryType: m.memoryType,
          relevanceScore: parseFloat(m.score.toFixed(3)),
        }));
      } else {
        // Fallback: keyword match
        const q = query.toLowerCase();
        results = allMemories
          .filter(m => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q))
          .slice(0, 5)
          .map(m => ({ key: m.key, value: m.value, memoryType: m.memoryType, relevanceScore: 0.5 }));
      }
    } else {
      // No embeddings — keyword search
      const q = query.toLowerCase();
      results = allMemories
        .filter(m => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q))
        .slice(0, 5)
        .map(m => ({ key: m.key, value: m.value, memoryType: m.memoryType, relevanceScore: 0.5 }));
    }

    return {
      success: true,
      output: { query, results, totalMemories: allMemories.length },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const memoryStoreTool: ToolDefinition = {
  name: "store_memory",
  description: "Store important information in persistent session memory for later retrieval. Use to remember facts, preferences, intermediate results, or any information that should persist across conversation steps.",
  parameters: {
    key:        { type: "string", description: "Memory key — a descriptive identifier (e.g., 'user_preference', 'task_result', 'api_endpoint')", required: true },
    value:      { type: "string", description: "The information to store", required: true },
    memoryType: { type: "string", description: "Type: 'fact', 'preference', 'result', 'context', 'url', 'code'. Default: 'fact'", required: false },
  },
  execute: async (params) => {
    return storeMemory(
      String(params.sessionId ?? ""),
      String(params.key),
      String(params.value),
      String(params.memoryType ?? "fact")
    );
  },
};

export const memorySearchTool: ToolDefinition = {
  name: "search_memory",
  description: "Search through stored session memories using semantic similarity or keyword matching. Use to recall information previously stored in this conversation session.",
  parameters: {
    query: { type: "string", description: "What to search for in memory (natural language)", required: true },
  },
  execute: async (params) => {
    return searchMemory(String(params.sessionId ?? ""), String(params.query));
  },
};
