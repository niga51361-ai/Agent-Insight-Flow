import { Request, Response, NextFunction } from "express";
import { getApiKeyBySecret } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ error: "Unauthorized: API Key missing" });
  }

  const foundKey = await getApiKeyBySecret(apiKey);

  if (!foundKey || !foundKey.enabled || (foundKey.expiresAt && new Date() > foundKey.expiresAt)) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired API Key" });
  }

  req.user = { id: foundKey.userId };
  next();
}
