import { db } from "../index";
import { scheduledTasksTable, NewScheduledTask, ScheduledTask } from "../schema/scheduledTasks";
import { eq } from "drizzle-orm";

export async function createScheduledTask(task: NewScheduledTask): Promise<ScheduledTask | undefined> {
  try {
    const [newTask] = await db.insert(scheduledTasksTable).values(task).returning();
    return newTask;
  } catch (error) {
    console.error("Error creating scheduled task:", error);
    return undefined;
  }
}

export async function getScheduledTaskById(taskId: string): Promise<ScheduledTask | undefined> {
  try {
    const [task] = await db.select().from(scheduledTasksTable).where(eq(scheduledTasksTable.id, taskId));
    return task;
  } catch (error) {
    console.error("Error getting scheduled task by ID:", error);
    return undefined;
  }
}

export async function listScheduledTasks(userId: string): Promise<ScheduledTask[]> {
  try {
    const tasks = await db.select().from(scheduledTasksTable).where(eq(scheduledTasksTable.userId, userId));
    return tasks;
  } catch (error) {
    console.error("Error listing scheduled tasks:", error);
    return [];
  }
}

export async function updateScheduledTask(taskId: string, updates: Partial<NewScheduledTask>): Promise<ScheduledTask | undefined> {
  try {
    const [updatedTask] = await db.update(scheduledTasksTable).set({ ...updates, updatedAt: new Date() }).where(eq(scheduledTasksTable.id, taskId)).returning();
    return updatedTask;
  } catch (error) {
    console.error("Error updating scheduled task:", error);
    return undefined;
  }
}

export async function deleteScheduledTask(taskId: string): Promise<boolean> {
  try {
    const result = await db.delete(scheduledTasksTable).where(eq(scheduledTasksTable.id, taskId)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Error deleting scheduled task:", error);
    return false;
  }
}

export async function getDueScheduledTasks(): Promise<ScheduledTask[]> {
  try {
    const now = new Date();
    const tasks = await db.select().from(scheduledTasksTable)
      .where(sql`${scheduledTasksTable.nextRunAt} <= ${now} AND ${scheduledTasksTable.status} = 'pending'`);
    return tasks;
  } catch (error) {
    console.error("Error getting due scheduled tasks:", error);
    return [];
  }
}

// Helper to calculate next run time based on cron expression
import cronParser from 'cron-parser';
import { sql } from 'drizzle-orm';

export function calculateNextRun(cronExpression: string, now: Date = new Date()): Date | undefined {
  try {
    const interval = cronParser.parseExpression(cronExpression, { currentDate: now });
    return interval.next().toDate();
  } catch (error) {
    console.error("Error parsing cron expression:", error);
    return undefined;
  }
}
