import OpenAI from "openai";
import { logger } from "../../lib/logger.js";

let _openaiInstance: OpenAI | null = null;
  function getOpenAI(): OpenAI {
    if (!_openaiInstance) {
      _openaiInstance = new OpenAI({
        apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "placeholder",
        baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
      });
    }
    return _openaiInstance;
  }

export interface CriticResult {
  approved: boolean;
  score: number;
  issues: string[];
  corrections: string[];
  improvedAnswer: string;
  critiqueRounds: number;
}

const CRITIC_SYSTEM_PROMPT = `You are an elite AI quality reviewer — the world's most precise "Error Hunter". Your sole job is to review AI-generated answers and find any flaws.

## Review Criteria:
1. **Accuracy** — Is every fact, number, and claim correct?
2. **Completeness** — Does the answer fully address the user's goal?
3. **Code Quality** — If code is present: Does it run? Are there bugs? Is it production-ready?
4. **Logic** — Is the reasoning sound and the conclusions valid?
5. **Clarity** — Is the answer clear, well-structured, and professional?

## Your Response Format (strict JSON):
{
  "approved": true/false,
  "score": 0-100,
  "issues": ["list of found problems, empty if none"],
  "corrections": ["specific fixes needed, empty if approved"],
  "improvedAnswer": "the full corrected answer (copy original if approved, improve if not)"
}

Be extremely critical. A score below 85 requires rejection and improvement. Only approve answers that are genuinely high quality.`;

export async function runCritic(
  goal: string,
  answer: string,
  maxRounds: number = 2
): Promise<CriticResult> {
  let currentAnswer = answer;
  let critiqueRounds = 0;
  let finalResult: CriticResult = {
    approved: true,
    score: 100,
    issues: [],
    corrections: [],
    improvedAnswer: answer,
    critiqueRounds: 0,
  };

  for (let round = 0; round < maxRounds; round++) {
    critiqueRounds++;

    let response: OpenAI.ChatCompletion;
    try {
      response = await getOpenAI().chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: CRITIC_SYSTEM_PROMPT },
          {
            role: "user",
            content: `## User's Original Goal:\n${goal}\n\n## AI-Generated Answer to Review:\n${currentAnswer}\n\nReview this answer strictly. Return your evaluation as JSON.`,
          },
        ],
        max_completion_tokens: 4096,
        response_format: { type: "json_object" },
      });
    } catch (err) {
      logger.warn({ err }, "Critic call failed, returning original answer");
      break;
    }

    const content = response.choices[0]?.message?.content ?? "{}";
    let critique: {
      approved?: boolean;
      score?: number;
      issues?: string[];
      corrections?: string[];
      improvedAnswer?: string;
    };

    try {
      critique = JSON.parse(content);
    } catch {
      break;
    }

    finalResult = {
      approved: critique.approved ?? true,
      score: critique.score ?? 100,
      issues: critique.issues ?? [],
      corrections: critique.corrections ?? [],
      improvedAnswer: critique.improvedAnswer ?? currentAnswer,
      critiqueRounds,
    };

    if (finalResult.approved || (finalResult.score ?? 0) >= 85) {
      break;
    }

    currentAnswer = finalResult.improvedAnswer;
    logger.info({ round: round + 1, score: finalResult.score }, "Critic rejected answer, applying corrections");
  }

  return finalResult;
}
