import { db } from "../index.js";
import { apiKeysTable, NewApiKey, ApiKey } from "../schema/apiKeys.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function generateApiSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createApiKey(userId: string, name: string, expiresAt?: Date): Promise<ApiKey | undefined> {
  try {
    const key = generateApiSecret(); // Generate a secure API key
    const [newKey] = await db.insert(apiKeysTable).values({
      userId,
      name,
      key,
      expiresAt,
    }).returning();
    return newKey;
  } catch (error) {
    console.error("Error creating API key:", error);
    return undefined;
  }
}

export async function getApiKeyBySecret(key: string): Promise<ApiKey | undefined> {
  try {
    const [apiKey] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, key));
    return apiKey;
  } catch (error) {
    console.error("Error getting API key:", error);
    return undefined;
  }
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  try {
    const keys = await db.select().from(apiKeysTable).where(eq(apiKeysTable.userId, userId));
    return keys;
  } catch (error) {
    console.error("Error listing API keys:", error);
    return [];
  }
}

export async function updateApiKey(id: string, updates: Partial<NewApiKey>): Promise<ApiKey | undefined> {
  try {
    const [updatedKey] = await db.update(apiKeysTable).set({ ...updates, updatedAt: new Date() }).where(eq(apiKeysTable.id, id)).returning();
    return updatedKey;
  } catch (error) {
    console.error("Error updating API key:", error);
    return undefined;
  }
}

export async function getApiKeyById(id: string): Promise<ApiKey | undefined> {
  try {
    const [apiKey] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id));
    return apiKey;
  } catch (error) {
    console.error("Error getting API key by ID:", error);
    return undefined;
  }
}

export async function deleteApiKey(id: string): Promise<boolean> {
  try {
    const result = await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Error deleting API key:", error);
    return false;
  }
}
