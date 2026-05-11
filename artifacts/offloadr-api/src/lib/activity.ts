import { db, activityLogsTable } from "@workspace/db";

export async function logActivity(
  projectId: number,
  action: string,
  message: string,
  userId?: number,
): Promise<void> {
  await db.insert(activityLogsTable).values({
    projectId,
    action,
    message,
    userId: userId ?? null,
  });
}
