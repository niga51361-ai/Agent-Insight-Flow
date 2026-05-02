import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { createScheduledTask, getScheduledTaskById, listScheduledTasks, updateScheduledTask, deleteScheduledTask, calculateNextRun } from "@workspace/db";
import { z } from "zod";

const router = Router();

const scheduledTaskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  prompt: z.string().min(1, "Prompt is required"),
  cronExpression: z.string().min(1, "Cron expression is required"),
  repeat: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

// Create a new scheduled task
router.post("/scheduled-tasks", authMiddleware, async (req, res) => {
  try {
    const validatedData = scheduledTaskSchema.parse(req.body);
    const userId = req.user?.id; // Assuming req.user is populated by authMiddleware

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const nextRunAt = calculateNextRun(validatedData.cronExpression);

    const newTask = await createScheduledTask({
      userId,
      ...validatedData,
      nextRunAt: nextRunAt || null,
      status: "pending",
    });

    if (newTask) {
      res.status(201).json(newTask);
    } else {
      res.status(500).json({ error: "Failed to create scheduled task" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    } else {
      console.error("Error creating scheduled task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Get all scheduled tasks for a user
router.get("/scheduled-tasks", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tasks = await listScheduledTasks(userId);
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error listing scheduled tasks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a specific scheduled task by ID
router.get("/scheduled-tasks/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const taskId = req.params.id;
    const task = await getScheduledTaskById(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: "Scheduled task not found or unauthorized" });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error("Error getting scheduled task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update a scheduled task
router.put("/scheduled-tasks/:id", authMiddleware, async (req, res) => {
  try {
    const validatedData = scheduledTaskSchema.partial().parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const taskId = req.params.id;
    const existingTask = await getScheduledTaskById(taskId);

    if (!existingTask || existingTask.userId !== userId) {
      return res.status(404).json({ error: "Scheduled task not found or unauthorized" });
    }

    let nextRunAt = existingTask.nextRunAt;
    if (validatedData.cronExpression) {
      nextRunAt = calculateNextRun(validatedData.cronExpression);
    }

    const updatedTask = await updateScheduledTask(taskId, { ...validatedData, nextRunAt: nextRunAt || null });

    if (updatedTask) {
      res.status(200).json(updatedTask);
    } else {
      res.status(500).json({ error: "Failed to update scheduled task" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    } else {
      console.error("Error updating scheduled task:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Delete a scheduled task
router.delete("/scheduled-tasks/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const taskId = req.params.id;
    const existingTask = await getScheduledTaskById(taskId);

    if (!existingTask || existingTask.userId !== userId) {
      return res.status(404).json({ error: "Scheduled task not found or unauthorized" });
    }

    const deleted = await deleteScheduledTask(taskId);
    if (deleted) {
      res.status(204).send(); // No content
    } else {
      res.status(500).json({ error: "Failed to delete scheduled task" });
    }
  } catch (error) {
    console.error("Error deleting scheduled task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
