import { db } from "@workspace/db";
import { platformSecretsTable, platformConfigTable } from "@workspace/db";
import { decrypt } from "./encryption.js";
import { logger } from "./logger.js";

const _secretsCache = new Map<string, string>();
const _configCache = new Map<string, string>();

export async function loadSecretsIntoCache(): Promise<void> {
  try {
    const secrets = await db.select().from(platformSecretsTable);
    for (const s of secrets) {
      try {
        const decrypted = decrypt(s.encryptedValue);
        _secretsCache.set(s.key, decrypted);
        process.env[s.key] = decrypted;
      } catch {
        logger.warn({ key: s.key }, "Failed to decrypt secret");
      }
    }
    logger.info({ count: secrets.length }, "Loaded secrets into cache");
  } catch (err) {
    logger.warn({ err }, "Could not load secrets from DB (table may not exist yet)");
  }
}

export async function loadConfigIntoCache(): Promise<void> {
  try {
    const configs = await db.select().from(platformConfigTable);
    for (const c of configs) {
      _configCache.set(c.key, c.value);
    }
    logger.info({ count: configs.length }, "Loaded config into cache");
  } catch (err) {
    logger.warn({ err }, "Could not load config from DB (table may not exist yet)");
  }
}

export function getSecret(key: string): string | undefined {
  return _secretsCache.get(key) ?? process.env[key];
}

export function getConfig(key: string, fallback?: string): string | undefined {
  return _configCache.get(key) ?? fallback;
}

export function refreshSecret(key: string, value: string): void {
  _secretsCache.set(key, value);
  process.env[key] = value;
}

export function refreshConfig(key: string, value: string): void {
  _configCache.set(key, value);
}

export function deleteSecretFromCache(key: string): void {
  _secretsCache.delete(key);
  delete process.env[key];
}
