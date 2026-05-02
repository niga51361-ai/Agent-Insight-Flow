import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { createApiKey, listApiKeys, deleteApiKey, getApiKey } from "@workspace/db";
import { z } from "zod";

const router = Router();

const apiKeySchema = z.object({
  name: z.string().min(1, "API Key name is required"),
  expiresAt: z.string().datetime().optional(),
});

// Create a new API Key
router.post("/api-keys", authMiddleware, async (req, res) => {
  try {
    const validatedData = apiKeySchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const newKey = await createApiKey(userId, validatedData.name, validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined);

    if (newKey) {
      res.status(201).json(newKey);
    } else {
      res.status(500).json({ error: "Failed to create API key" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    } else {
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// List all API Keys for a user
router.get("/api-keys", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const keys = await listApiKeys(userId);
    res.status(200).json(keys);
  } catch (error) {
    console.error("Error listing API keys:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete an API Key
router.delete("/api-keys/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const keyId = req.params.id;
    // Ensure the key belongs to the user before deleting
    const existingKey = await getApiKeyById(keyId);
    if (!existingKey || existingKey.userId !== userId) {
      return res.status(404).json({ error: "API Key not found or unauthorized" });
    }

    const deleted = await deleteApiKey(keyId);
    if (deleted) {
      res.status(204).send();
    } else {
      res.status(500).json({ error: "Failed to delete API key" });
    }
  } catch (error) {
    console.error("Error deleting API key:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
