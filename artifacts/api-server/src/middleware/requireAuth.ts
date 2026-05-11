import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req.session as Record<string, unknown>)?.["userId"] as
    | number
    | undefined;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  next();
}

export function getSessionUserId(req: Request): number | undefined {
  return (req.session as Record<string, unknown>)?.["userId"] as
    | number
    | undefined;
}
