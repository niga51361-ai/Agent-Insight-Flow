import { getDueScheduledTasks, updateScheduledTask, calculateNextRun, getAgentPersonality } from "@workspace/db";
import { orchestrate } from "../agent/executor/orchestrator";
import { logger } from "../lib/logger.js";

const TASK_PROCESSING_INTERVAL = 60 * 1000; // 1 minute

async function processScheduledTasks() {
  logger.info("Scheduled task worker started.");
  try {
    const dueTasks = await getDueScheduledTasks();
    logger.info(`Found ${dueTasks.length} due scheduled tasks.`);

    for (const task of dueTasks) {
      logger.info(`Processing scheduled task: ${task.name} (ID: ${task.id})`);
      await updateScheduledTask(task.id, { status: "running", lastRunAt: new Date() });

      try {
        // Trigger the orchestration process for the scheduled task
        const result = await orchestrate({
          userId: task.userId,
          sessionId: `scheduled-task-${task.id}`,
          goal: task.prompt,
          agentPersonality: await getAgentPersonality(task.userId),
        });

        if (result.success) {
          logger.info(`Scheduled task ${task.id} completed successfully.`);
          const nextRunAt = task.repeat ? calculateNextRun(task.cronExpression) : null;
          await updateScheduledTask(task.id, { status: nextRunAt ? "pending" : "completed", nextRunAt });
        } else {
          logger.error(`Scheduled task ${task.id} failed: ${result.error}`);
          const nextRunAt = task.repeat ? calculateNextRun(task.cronExpression) : null;
          await updateScheduledTask(task.id, { status: nextRunAt ? "pending" : "failed", nextRunAt });
        }
      } catch (error) {
        logger.error(`Error executing scheduled task ${task.id}:`, error);
        const nextRunAt = task.repeat ? calculateNextRun(task.cronExpression) : null;
        await updateScheduledTask(task.id, { status: nextRunAt ? "pending" : "failed", nextRunAt });
      }
    }
  } catch (error) {
    logger.error("Error in scheduled task worker:", error);
  }
  logger.info("Scheduled task worker finished.");
}

export function startScheduledTaskWorker() {
  // Run immediately and then at the specified interval
  processScheduledTasks();
  setInterval(processScheduledTasks, TASK_PROCESSING_INTERVAL);
}
