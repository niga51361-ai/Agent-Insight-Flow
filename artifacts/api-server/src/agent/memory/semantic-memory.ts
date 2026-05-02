import OpenAI from "openai";
import { db } from "@workspace/db";
import { agentMemoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

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

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000),
    });
    return response.data[0]?.embedding ?? [];
  } catch (err) {
    logger.warn({ err }, "Failed to generate embedding");
    return [];
  }
}

export interface SemanticMemoryResult {
  key: string;
  value: string;
  memoryType: string;
  similarity: number;
}

export class SemanticMemoryManager {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async store(
    key: string,
    value: string,
    memoryType: string = "fact",
    ttlHours?: number
  ): Promise<void> {
    const text = `${key}: ${value}`;
    const embedding = await generateEmbedding(text);
    const expiresAt = ttlHours
      ? new Date(Date.now() + ttlHours * 60 * 60 * 1000)
      : null;

    await db
      .insert(agentMemoryTable)
      .values({
        sessionId: this.sessionId,
        memoryType,
        key,
        value,
        embedding: embedding.length > 0 ? embedding : null,
        expiresAt,
      })
      .onConflictDoNothing();
  }

  async semanticSearch(
    query: string,
    topK: number = 5,
    threshold: number = 0.6
  ): Promise<SemanticMemoryResult[]> {
    const queryEmbedding = await generateEmbedding(query);

    const records = await db
      .select({
        key: agentMemoryTable.key,
        value: agentMemoryTable.value,
        memoryType: agentMemoryTable.memoryType,
        embedding: agentMemoryTable.embedding,
      })
      .from(agentMemoryTable)
      .where(eq(agentMemoryTable.sessionId, this.sessionId))
      .limit(200);

    const results: SemanticMemoryResult[] = [];

    for (const record of records) {
      if (!record.embedding || !Array.isArray(record.embedding)) {
        // Fall back to keyword match for records without embeddings
        const keywordMatch =
          record.key.toLowerCase().includes(query.toLowerCase()) ||
          record.value.toLowerCase().includes(query.toLowerCase());
        if (keywordMatch) {
          results.push({
            key: record.key,
            value: record.value,
            memoryType: record.memoryType,
            similarity: 0.7,
          });
        }
        continue;
      }

      const emb = record.embedding as number[];
      if (queryEmbedding.length === 0) {
        results.push({
          key: record.key,
          value: record.value,
          memoryType: record.memoryType,
          similarity: 0.5,
        });
        continue;
      }

      const similarity = cosineSimilarity(queryEmbedding, emb);
      if (similarity >= threshold) {
        results.push({
          key: record.key,
          value: record.value,
          memoryType: record.memoryType,
          similarity,
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  async getAll(): Promise<Array<{ key: string; value: string; memoryType: string }>> {
    const records = await db
      .select({
        key: agentMemoryTable.key,
        value: agentMemoryTable.value,
        memoryType: agentMemoryTable.memoryType,
      })
      .from(agentMemoryTable)
      .where(eq(agentMemoryTable.sessionId, this.sessionId))
      .limit(50);
    return records;
  }
}
