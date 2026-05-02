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

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  tokensEstimate?: number;
}

const COMPRESSION_THRESHOLD = 8000;
const MAX_RECENT_MESSAGES = 6;
const TOKENS_PER_CHAR = 0.25;

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

function totalTokens(messages: ConversationMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

export async function compressContext(
  messages: ConversationMessage[],
  goal: string
): Promise<ConversationMessage[]> {
  const total = totalTokens(messages);

  if (total < COMPRESSION_THRESHOLD || messages.length <= MAX_RECENT_MESSAGES) {
    return messages;
  }

  logger.info({ totalTokens: total, messageCount: messages.length }, "Context compression triggered");

  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const toCompress = conversationMessages.slice(0, -MAX_RECENT_MESSAGES);
  const recent = conversationMessages.slice(-MAX_RECENT_MESSAGES);

  if (toCompress.length === 0) {
    return messages;
  }

  const conversationText = toCompress
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a context summarizer. Your job is to create a highly compressed but information-dense summary of a conversation. 
          
The summary must preserve:
- All factual data, numbers, names, URLs found
- Key decisions made
- Results of tools and actions taken
- Current state of the task
- Any important context needed to continue

Be extremely concise. This summary replaces multiple messages to save tokens.
Goal being worked on: ${goal}`,
        },
        {
          role: "user",
          content: `Compress this conversation into a dense summary:\n\n${conversationText}`,
        },
      ],
      max_completion_tokens: 800,
    });

    const summary = response.choices[0]?.message?.content ?? conversationText.substring(0, 2000);

    logger.info(
      {
        originalMessages: toCompress.length,
        originalTokens: totalTokens(toCompress),
        summaryTokens: estimateTokens(summary),
      },
      "Context compressed successfully"
    );

    const compressedMessage: ConversationMessage = {
      role: "assistant",
      content: `[CONTEXT SUMMARY - Previous conversation compressed]\n${summary}`,
    };

    return [...systemMessages, compressedMessage, ...recent];
  } catch (err) {
    logger.error({ err }, "Context compression failed, using original messages");
    return messages;
  }
}

export function shouldCompress(messages: ConversationMessage[]): boolean {
  return totalTokens(messages) >= COMPRESSION_THRESHOLD && messages.length > MAX_RECENT_MESSAGES;
}
