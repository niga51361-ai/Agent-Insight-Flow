import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { createIntegration, getIntegration, listIntegrations, updateIntegration, deleteIntegration } from "@workspace/db";
import { z } from "zod";

const router = Router();

const integrationSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  config: z.record(z.any()).optional(),
});

// Create a new integration
router.post("/integrations", authMiddleware, async (req, res) => {
  try {
    const validatedData = integrationSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const newIntegration = await createIntegration({
      userId,
      ...validatedData,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
    });

    if (newIntegration) {
      res.status(201).json(newIntegration);
    } else {
      res.status(500).json({ error: "Failed to create integration" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    } else {
      console.error("Error creating integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// List all integrations for a user
router.get("/integrations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const integrations = await listIntegrations(userId);
    res.status(200).json(integrations);
  } catch (error) {
    console.error("Error listing integrations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a specific integration by provider
router.get("/integrations/:provider", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const provider = req.params.provider;
    const integration = await getIntegration(userId, provider);

    if (!integration || integration.userId !== userId) {
      return res.status(404).json({ error: "Integration not found or unauthorized" });
    }

    res.status(200).json(integration);
  } catch (error) {
    console.error("Error getting integration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update an integration
router.put("/integrations/:id", authMiddleware, async (req, res) => {
  try {
    const validatedData = integrationSchema.partial().parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const integrationId = req.params.id;
    // Ensure the integration belongs to the user before updating
    const existingIntegrations = await listIntegrations(userId);
    const existingIntegration = existingIntegrations.find(int => int.id === integrationId);

    if (!existingIntegration || existingIntegration.userId !== userId) {
      return res.status(404).json({ error: "Integration not found or unauthorized" });
    }

    const updatedIntegration = await updateIntegration(integrationId, { ...validatedData, expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined });

    if (updatedIntegration) {
      res.status(200).json(updatedIntegration);
    } else {
      res.status(500).json({ error: "Failed to update integration" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    } else {
      console.error("Error updating integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Delete an integration
router.delete("/integrations/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const integrationId = req.params.id;
    // Ensure the integration belongs to the user before deleting
    const existingIntegrations = await listIntegrations(userId);
    const existingIntegration = existingIntegrations.find(int => int.id === integrationId);

    if (!existingIntegration || existingIntegration.userId !== userId) {
      return res.status(404).json({ error: "Integration not found or unauthorized" });
    }

    const deleted = await deleteIntegration(integrationId);
    if (deleted) {
      res.status(204).send(); // No content
    } else {
      res.status(500).json({ error: "Failed to delete integration" });
    }
  } catch (error) {
    console.error("Error deleting integration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
