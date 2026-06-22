import type { Request, Response } from "express";
import type { ZodSchema, ZodError } from "zod";

export function parseBody<T>(
  req: Request,
  res: Response,
  schema: ZodSchema<T>,
): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "Bad Request",
      message: "Invalid request body",
      issues: formatIssues(result.error),
    });
    return null;
  }
  return result.data;
}

function formatIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
