import OpenAI from "openai";
import { deductCredits } from "@workspace/db";

const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
});

export async function generateEmbedding(userId: string, text: string): Promise<number[]> {
  const EMBEDDING_COST_PER_TOKEN = 0.0000001; // Example cost, adjust as needed
  const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
  const cost = estimatedTokens * EMBEDDING_COST_PER_TOKEN;

  const creditsDeducted = await deductCredits(userId, cost, "Embedding generation");
  if (!creditsDeducted) {
    throw new Error("Insufficient credits for embedding generation.");
  }
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002", // Or a more advanced embedding model if available
    input: text,
  });
  return response.data[0].embedding;
}
