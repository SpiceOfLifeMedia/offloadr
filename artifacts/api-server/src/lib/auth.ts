import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sess = req.session as Record<string, unknown>;
  if (!sess["userId"]) {
    res.status(401).json({ error: "Unauthorized", message: "You must be logged in" });
    return;
  }
  next();
}

export function getUserId(req: Request): number | null {
  const sess = req.session as Record<string, unknown>;
  const id = sess["userId"];
  if (typeof id === "number") return id;
  return null;
}
