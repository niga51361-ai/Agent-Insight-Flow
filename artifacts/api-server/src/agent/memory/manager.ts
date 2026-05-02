import { db } from "@workspace/db";
import { agentMemoryTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

export class MemoryManager {
  private sessionId: string;
  private localCache: Map<string, string> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async store(key: string, value: string, memoryType: string = "fact", ttlHours?: number): Promise<void> {
    this.localCache.set(key, value);

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
        expiresAt,
      })
      .onConflictDoNothing();
  }

  async retrieve(key: string): Promise<string | null> {
    if (this.localCache.has(key)) {
      return this.localCache.get(key) ?? null;
    }

    const [record] = await db
      .select()
      .from(agentMemoryTable)
      .where(
        and(
          eq(agentMemoryTable.sessionId, this.sessionId),
          eq(agentMemoryTable.key, key),
          gt(agentMemoryTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (record) {
      this.localCache.set(key, record.value);
      return record.value;
    }

    return null;
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

    for (const r of records) {
      this.localCache.set(r.key, r.value);
    }

    return records;
  }

  getLocalSnapshot(): Record<string, string> {
    const snapshot: Record<string, string> = {};
    for (const [k, v] of this.localCache.entries()) {
      snapshot[k] = v;
    }
    return snapshot;
  }
}
