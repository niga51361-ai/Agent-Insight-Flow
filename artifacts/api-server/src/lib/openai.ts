import OpenAI from "openai";
import { logger } from "./logger.js";

let _instance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_instance) {
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
    const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];

    if (!apiKey) {
      logger.warn("AI_INTEGRATIONS_OPENAI_API_KEY is not set — OpenAI calls will fail");
    }

    _instance = new OpenAI({
      apiKey: apiKey ?? "placeholder-key",
      ...(baseURL ? { baseURL } : {}),
    });
  }
  return _instance;
}
