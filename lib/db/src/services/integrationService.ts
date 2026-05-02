import { db } from "../index";
import { integrationsTable, NewIntegration, Integration } from "../schema/integrations";
import { eq } from "drizzle-orm";

export async function createIntegration(integration: NewIntegration): Promise<Integration | undefined> {
  try {
    const [newIntegration] = await db.insert(integrationsTable).values(integration).returning();
    return newIntegration;
  } catch (error) {
    console.error("Error creating integration:", error);
    return undefined;
  }
}

export async function getIntegration(userId: string, provider: string): Promise<Integration | undefined> {
  try {
    const [integration] = await db.select().from(integrationsTable).where(eq(integrationsTable.userId, userId) && eq(integrationsTable.provider, provider));
    return integration;
  } catch (error) {
    console.error("Error getting integration:", error);
    return undefined;
  }
}

export async function listIntegrations(userId: string): Promise<Integration[]> {
  try {
    const integrations = await db.select().from(integrationsTable).where(eq(integrationsTable.userId, userId));
    return integrations;
  } catch (error) {
    console.error("Error listing integrations:", error);
    return [];
  }
}

export async function updateIntegration(id: string, updates: Partial<NewIntegration>): Promise<Integration | undefined> {
  try {
    const [updatedIntegration] = await db.update(integrationsTable).set({ ...updates, updatedAt: new Date() }).where(eq(integrationsTable.id, id)).returning();
    return updatedIntegration;
  } catch (error) {
    console.error("Error updating integration:", error);
    return undefined;
  }
}

export async function deleteIntegration(id: string): Promise<boolean> {
  try {
    const result = await db.delete(integrationsTable).where(eq(integrationsTable.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Error deleting integration:", error);
    return false;
  }
}
