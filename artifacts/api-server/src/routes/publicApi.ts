import { Router } from "express";
import { apiKeyMiddleware } from "../middleware/apiKeyMiddleware";
import { orchestrate } from "../agent/executor/orchestrator";
import { getAgentPersonality } from "@workspace/db";
import { z } from "zod";

const router = Router();

const publicOrchestrationSchema = z.object({
  goal: z.string().min(1, "Goal is required"),
  sessionId: z.string().optional(),
});

// Public API endpoint to trigger orchestration
router.post("/orchestrate", apiKeyMiddleware, async (req, res) => {
  try {
    const validatedData = publicOrchestrationSchema.parse(req.body);
    const userId = req.user?.id; // Populated by apiKeyMiddleware

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await orchestrate({
      userId,
      sessionId: validatedData.sessionId || `public-api-${userId}-${Date.now()}`,
      goal: validatedData.goal,
      agentPersonality: await getAgentPersonality(userId),
    });

    if (result.success) {
      res.status(200).json({ message: "Orchestration started successfully", orchestrationId: result.orchestrationId });
    } else {
      res.status(500).json({ error: result.error || "Failed to start orchestration" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    } else {
      console.error("Error in public API orchestration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
