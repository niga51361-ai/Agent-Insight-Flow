import { db } from "@workspace/db";
import { agentMemoryTable } from "@workspace/db";
import { eq, and, like, or, gt } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export interface HybridSearchResult {
  key: string;
  value: string;
  memoryType: string;
  score: number;
  matchType: "keyword" | "semantic" | "hybrid";
}

function keywordScore(text: string, query: string): number {
  const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const textLower = text.toLowerCase();

  if (queryTokens.length === 0) return 0;

  let matches = 0;
  let exactPhraseBonus = 0;

  for (const token of queryTokens) {
    if (textLower.includes(token)) {
      matches++;
    }
  }

  if (textLower.includes(query.toLowerCase())) {
    exactPhraseBonus = 0.5;
  }

  return (matches / queryTokens.length) + exactPhraseBonus;
}

function semanticScore(text: string, query: string): number {
  const queryTokens = new Set(query.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const textTokens = new Set(text.toLowerCase().split(/\s+/).filter((t) => t.length > 3));

  if (queryTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) intersection++;
  }

  const union = queryTokens.size + textTokens.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export async function hybridSearch(
  sessionId: string,
  query: string,
  limit: number = 10
): Promise<HybridSearchResult[]> {
  try {
    const queryTokens = query
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 5);

    const conditions = [eq(agentMemoryTable.sessionId, sessionId)];

    if (queryTokens.length > 0) {
      const keywordConditions = queryTokens.map((token) =>
        or(
          like(agentMemoryTable.key, `%${token}%`),
          like(agentMemoryTable.value, `%${token}%`)
        )
      );
      conditions.push(or(...(keywordConditions as any[])) as any);
    }

    const candidates = await db
      .select({
        key: agentMemoryTable.key,
        value: agentMemoryTable.value,
        memoryType: agentMemoryTable.memoryType,
        expiresAt: agentMemoryTable.expiresAt,
      })
      .from(agentMemoryTable)
      .where(and(...conditions))
      .limit(50);

    const now = new Date();
    const valid = candidates.filter(
      (c) => !c.expiresAt || c.expiresAt > now
    );

    const scored: HybridSearchResult[] = valid.map((record) => {
      const fullText = `${record.key} ${record.value}`;
      const kw = keywordScore(fullText, query);
      const sem = semanticScore(fullText, query);

      const kwWeight = 0.55;
      const semWeight = 0.45;
      const score = kw * kwWeight + sem * semWeight;

      let matchType: HybridSearchResult["matchType"] = "hybrid";
      if (kw > 0.7 && sem < 0.3) matchType = "keyword";
      else if (sem > 0.5 && kw < 0.3) matchType = "semantic";

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
      { sessionId, query: query.substring(0, 50), resultCount: results.length },
      "Hybrid search completed"
    );

    return results;
  } catch (err) {
    logger.error({ err, sessionId, query }, "Hybrid search failed");
    return [];
  }
}

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
