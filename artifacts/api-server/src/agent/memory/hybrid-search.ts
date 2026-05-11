import { db } from "@workspace/db";
import { agentMemoryTable } from "@workspace/db";
import { eq, and, like, or } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { getOpenAI } from "../../lib/openai.js";

export interface HybridSearchResult {
  key: string;
  value: string;
  memoryType: string;
  score: number;
  matchType: "keyword" | "semantic" | "hybrid";
}

// ─── Keyword Score ────────────────────────────────────────────────────────────
function keywordScore(text: string, query: string): number {
  const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const textLower = text.toLowerCase();

  if (queryTokens.length === 0) return 0;

  let matches = 0;
  for (const token of queryTokens) {
    if (textLower.includes(token)) matches++;
  }

  const exactPhraseBonus = textLower.includes(query.toLowerCase()) ? 0.5 : 0;
  return matches / queryTokens.length + exactPhraseBonus;
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// ─── Real Embedding via OpenAI ────────────────────────────────────────────────
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: query.substring(0, 8000),
    });
    return response.data[0]?.embedding ?? null;
  } catch (err) {
    logger.warn({ err }, "Failed to get query embedding — falling back to keyword-only");
    return null;
  }
}

// ─── Hybrid Search ────────────────────────────────────────────────────────────
export async function hybridSearch(
  sessionId: string,
  query: string,
  limit: number = 10
): Promise<HybridSearchResult[]> {
  try {
    // Fast keyword pre-filter to get candidates
    const queryTokens = query
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 5);

    const baseCondition = eq(agentMemoryTable.sessionId, sessionId);

    const dbConditions =
      queryTokens.length > 0
        ? and(
            baseCondition,
            or(
              ...(queryTokens.map((token) =>
                or(
                  like(agentMemoryTable.key, `%${token}%`),
                  like(agentMemoryTable.value, `%${token}%`)
                )
              ) as any[])
            ) as any
          )
        : baseCondition;

    // Run keyword DB query and embedding generation in parallel
    const [candidates, queryEmbedding] = await Promise.all([
      db
        .select({
          key: agentMemoryTable.key,
          value: agentMemoryTable.value,
          memoryType: agentMemoryTable.memoryType,
          embedding: agentMemoryTable.embedding,
          expiresAt: agentMemoryTable.expiresAt,
        })
        .from(agentMemoryTable)
        .where(dbConditions)
        .limit(100),
      getQueryEmbedding(query),
    ]);

    const now = new Date();
    const valid = candidates.filter((c) => !c.expiresAt || c.expiresAt > now);

    const scored: HybridSearchResult[] = valid.map((record) => {
      const fullText = `${record.key} ${record.value}`;
      const kw = keywordScore(fullText, query);

      const storedEmbedding = Array.isArray(record.embedding)
        ? (record.embedding as number[])
        : null;

      const hasEmbedding =
        queryEmbedding !== null &&
        storedEmbedding !== null &&
        storedEmbedding.length > 0;

      const sem = hasEmbedding
        ? cosineSimilarity(queryEmbedding!, storedEmbedding!)
        : 0;

      // When real embeddings are available, weight semantics higher
      const kwWeight = hasEmbedding ? 0.35 : 1.0;
      const semWeight = hasEmbedding ? 0.65 : 0.0;
      const score = kw * kwWeight + sem * semWeight;

      let matchType: HybridSearchResult["matchType"] = "hybrid";
      if (hasEmbedding) {
        if (sem > 0.65 && kw < 0.3) matchType = "semantic";
        else if (kw > 0.7 && sem < 0.2) matchType = "keyword";
      } else {
        matchType = "keyword";
      }

      return {
        key: record.key,
        value: record.value,
        memoryType: record.memoryType,
        score,
        matchType,
      };
    });

    const results = scored
      .filter((r) => r.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    logger.info(
      {
        sessionId,
        query: query.substring(0, 50),
        resultCount: results.length,
        embeddingsUsed: queryEmbedding !== null,
      },
      "Hybrid search completed"
    );

    return results;
  } catch (err) {
    logger.error({ err, sessionId, query }, "Hybrid search failed");
    return [];
  }
}

// ─── Keyword-only fallback ────────────────────────────────────────────────────
export async function keywordOnlySearch(
  sessionId: string,
  exactTerm: string,
  limit: number = 5
): Promise<{ key: string; value: string }[]> {
  try {
    const results = await db
      .select({ key: agentMemoryTable.key, value: agentMemoryTable.value })
      .from(agentMemoryTable)
      .where(
        and(
          eq(agentMemoryTable.sessionId, sessionId),
          or(
            like(agentMemoryTable.key, `%${exactTerm}%`),
            like(agentMemoryTable.value, `%${exactTerm}%`)
          )
        )
      )
      .limit(limit);

    return results;
  } catch (err) {
    logger.error({ err }, "Keyword search failed");
    return [];
  }
}
