import { logger } from "../../lib/logger.js";

export interface TaskCheckpoint {
  taskId: string;
  stepNumber: number;
  currentStep: string;
  accumulatedResult: string;
  memorySnapshot: Record<string, string>;
  progress: number;
  savedAt: Date;
}

const checkpointCache = new Map<string, TaskCheckpoint>();

export async function saveCheckpoint(
  taskId: string,
  stepNumber: number,
  currentStep: string,
  accumulatedResult: string,
  memorySnapshot: Record<string, string>,
  progress: number
): Promise<void> {
  const checkpoint: TaskCheckpoint = {
    taskId,
    stepNumber,
    currentStep,
    accumulatedResult,
    memorySnapshot,
    progress,
    savedAt: new Date(),
  };

  checkpointCache.set(taskId, checkpoint);
  logger.info({ taskId, stepNumber, progress }, "Checkpoint saved in-memory");
}

export function getCheckpoint(taskId: string): TaskCheckpoint | null {
  return checkpointCache.get(taskId) ?? null;
}

export function clearCheckpoint(taskId: string): void {
  checkpointCache.delete(taskId);
}

export async function resumeFromCheckpoint(
  taskId: string
): Promise<{ canResume: boolean; checkpoint: TaskCheckpoint | null; reason: string }> {
  const cached = checkpointCache.get(taskId);

  if (cached) {
    const ageMs = Date.now() - cached.savedAt.getTime();
    const maxAge = 30 * 60 * 1000;

    if (ageMs < maxAge) {
      logger.info({ taskId, stepNumber: cached.stepNumber, ageMs }, "Resuming from cached checkpoint");
      return {
        canResume: true,
        checkpoint: cached,
        reason: `Resuming from step ${cached.stepNumber} (${Math.round(ageMs / 1000)}s ago)`,
      };
    }

    checkpointCache.delete(taskId);
    return {
      canResume: false,
      checkpoint: null,
      reason: "Checkpoint expired (older than 30 minutes)",
    };
  }

  return {
    canResume: false,
    checkpoint: null,
    reason: "No checkpoint found",
  };
}

export function computeDynamicMaxIterations(goal: string): number {
  const complexityIndicators = [
    /\b(research|analyze|compare|comprehensive|detailed|complete|full|entire)\b/i,
    /\b(website|application|system|platform|dashboard)\b/i,
    /\b(multiple|several|many|all|every)\b/i,
    /\band\b.*\band\b/i,
  ];

  let complexity = 0;
  for (const pattern of complexityIndicators) {
    if (pattern.test(goal)) complexity++;
  }

  const wordCount = goal.split(/\s+/).length;
  if (wordCount > 30) complexity++;
  if (wordCount > 60) complexity++;

  if (complexity === 0) return 8;
  if (complexity === 1) return 12;
  if (complexity === 2) return 18;
  if (complexity === 3) return 22;
  return 30;
}
