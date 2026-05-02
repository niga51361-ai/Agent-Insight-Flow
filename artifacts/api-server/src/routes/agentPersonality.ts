import { Router } from "express";
import { getAgentPersonality, updateAgentPersonality, initializeAgentPersonality } from "@workspace/db";

const router = Router();

router.get("/personality", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const personality = await getAgentPersonality(req.session.userId);
    res.json({ personality });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve agent personality", error: error.message });
  }
});

router.post("/personality", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { name, description, tone } = req.body;
  try {
    await updateAgentPersonality(req.session.userId, { name, description, tone });
    res.status(200).json({ message: "Agent personality updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update agent personality", error: error.message });
  }
});

// Endpoint to initialize agent personality for a new user (can be called on user creation)
router.post("/personality/initialize", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    await initializeAgentPersonality(req.session.userId);
    res.status(200).json({ message: "Agent personality initialized" });
  } catch (error) {
    res.status(500).json({ message: "Failed to initialize agent personality", error: error.message });
  }
});

export default router;
