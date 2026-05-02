import crypto from "crypto";

export function generateApiSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
