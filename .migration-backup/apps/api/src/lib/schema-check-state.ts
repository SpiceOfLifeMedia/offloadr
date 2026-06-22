import type { SchemaCheckResult } from "@workspace/db";

let lastResult: SchemaCheckResult | null = null;

export function setSchemaCheckResult(result: SchemaCheckResult): void {
  lastResult = result;
}

export function getSchemaCheckResult(): SchemaCheckResult | null {
  return lastResult;
}
