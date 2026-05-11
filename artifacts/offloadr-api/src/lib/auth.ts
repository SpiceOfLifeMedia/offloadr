import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (typeof req.session.userId !== "number") {
    res.status(401).json({ error: "Unauthorized", message: "You must be logged in" });
    return;
  }
  next();
}

export function getUserId(req: Request): number | null {
  const id = req.session.userId;
  return typeof id === "number" ? id : null;
}
