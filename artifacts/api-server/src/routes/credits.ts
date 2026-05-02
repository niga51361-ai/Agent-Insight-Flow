import { Router } from "express";
import { getUserCredits, addCredits, initializeUserCredits } from "@workspace/db";

const router = Router();

router.get("/credits", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const credits = await getUserCredits(req.session.userId);
    res.json({ credits });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve credits", error: error.message });
  }
});

router.post("/credits/add", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { amount, type, description } = req.body;
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }
  try {
    await addCredits(req.session.userId, amount, type || "manual_add", description || "");
    res.status(200).json({ message: "Credits added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add credits", error: error.message });
  }
});

// Endpoint to initialize credits for a new user (can be called on user creation)
router.post("/credits/initialize", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    await initializeUserCredits(req.session.userId);
    res.status(200).json({ message: "User credits initialized" });
  } catch (error) {
    res.status(500).json({ message: "Failed to initialize credits", error: error.message });
  }
});

export default router;
