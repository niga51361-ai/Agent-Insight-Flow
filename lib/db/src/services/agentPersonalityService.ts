import { db } from "../index.js";
import { agentPersonalitiesTable } from "../schema/agent";
import { eq } from "drizzle-orm";

export interface AgentPersonality {
  name: string;
  description?: string;
  tone: string;
}

export async function initializeAgentPersonality(userId: string): Promise<void> {
  await db.insert(agentPersonalitiesTable).values({ userId }).onConflictDoNothing();
}

export async function getAgentPersonality(userId: string): Promise<AgentPersonality | null> {
  const result = await db.select().from(agentPersonalitiesTable).where(eq(agentPersonalitiesTable.userId, userId));
  if (result.length > 0) {
    const { name, description, tone } = result[0];
    return { name, description: description || undefined, tone };
  }
  return null;
}

export async function updateAgentPersonality(userId: string, personality: Partial<AgentPersonality>): Promise<void> {
  await db.update(agentPersonalitiesTable)
    .set({ ...personality, updatedAt: new Date() })
    .where(eq(agentPersonalitiesTable.userId, userId));
}
