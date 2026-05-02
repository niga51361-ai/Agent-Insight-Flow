import type { ToolDefinition, ToolResult } from "./types.js";
import { db } from "@workspace/db";
import { agentMemoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0; // Avoid division by zero
  return dotProduct / (magnitudeA * magnitudeB);
}

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

async function storeMemory(
  sessionId: string,
  userId: string,
  key: string,
  value: string,
  memoryType: string
): Promise<ToolResult> {
  try {
    const embedding = await generateEmbedding(userId, value);
    await db
      .insert(agentMemoryTable)
      .values({ sessionId, memoryType, key, value, embedding })
      .onConflictDoNothing();

    return {
      success: true,
      output: { stored: true, key, memoryType, sessionId },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function searchMemory(sessionId: string, userId: string, query: string): Promise<ToolResult> {
  try {
    const queryEmbedding = await generateEmbedding(userId, query);

    const allMemories = await db
      .select()
      .from(agentMemoryTable)
      .where(eq(agentMemoryTable.sessionId, sessionId))
      .where(agentMemoryTable.embedding.isNotNull())
      .limit(100); // Limit for initial retrieval, will be filtered by similarity

    if (allMemories.length === 0) {
      return { success: true, output: { results: [], message: "No memories with embeddings stored in this session" } };
    }

    // Calculate cosine similarity and sort
    const memoriesWithSimilarity = allMemories.map((m) => {
      const memoryEmbedding = m.embedding as number[]; // Assuming embedding is stored as number[]
      const similarity = cosineSimilarity(queryEmbedding, memoryEmbedding);
      return { ...m, similarity };
    }).sort((a, b) => b.similarity - a.similarity);

    const topMemories = memoriesWithSimilarity.slice(0, 5); // Get top 5 relevant memories

    const memoryText = topMemories
      .map((m) => `[${m.memoryType}] ${m.key}: ${m.value} (Similarity: ${m.similarity.toFixed(2)})`)
      .join("\n");

    // Instead of relying on LLM for relevance, we use vector similarity
    // The LLM will now just format the results based on the top memories
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a memory search assistant. Given a query and a list of relevant memories (already sorted by relevance), format them into a clear, concise JSON array of objects with keys: key, value, memoryType, relevanceScore. Do not re-evaluate relevance, just present the provided data.",
        },
        {
          role: "user",
          content: `Query: ${query}\n\nTop Relevant Memories:\n${memoryText}`,
        },
      ],
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: { results?: Array<{ key: string; value: string; memoryType: string; relevanceScore: number }> };

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { results: topMemories.map((m) => ({
        key: m.key, value: m.value, memoryType: m.memoryType, relevanceScore: m.similarity,
      })) };
    }

    return {
      success: true,
      output: {
        query,
        results: parsed.results ?? [],
        totalMemories: allMemories.length,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const memoryStoreTool: ToolDefinition = {
  name: "store_memory",
  description:
    "Store important information in persistent session memory for later retrieval. Use to remember facts, preferences, intermediate results, or any information that should persist across steps. Types: 'fact', 'preference', 'result', 'context'.",
  parameters: {
    sessionId: { type: "string", description: "The session ID", required: true },
    userId: { type: "string", description: "The user ID", required: true },
    key: { type: "string", description: "Memory key (descriptive identifier)", required: true },
    value: { type: "string", description: "The information to store", required: true },
    memoryType: {
      type: "string",
      description: "Type: 'fact', 'preference', 'result', 'context', 'url', 'code'",
      required: false,
    },
  },
  execute: async (params) => {
    return storeMemory(
      String(params.sessionId),
      String(params.userId),
      String(params.key),
      String(params.value),
      String(params.memoryType ?? "fact")
    );
  },
};

export const memorySearchTool: ToolDefinition = {
  name: "search_memory",
  description:
    "Search through stored session memories to find relevant information from earlier in the conversation or task. Use when you need to recall something previously stored.",
  parameters: {
    sessionId: { type: "string", description: "The session ID to search in", required: true },
    userId: { type: "string", description: "The user ID", required: true },
    query: { type: "string", description: "What to search for in memory", required: true },
  },
  execute: async (params) => {
    return searchMemory(String(params.sessionId), String(params.userId), String(params.query));
  },
};
