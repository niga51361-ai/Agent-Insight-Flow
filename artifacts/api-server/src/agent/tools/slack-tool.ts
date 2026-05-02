import { BaseTool } from "./base-tool";
import { z } from "zod";
import { getIntegration } from "@workspace/db";
import { WebClient } from "@slack/web-api";
import { logger } from "../../lib/logger";

export class SlackTool extends BaseTool {
  name = "slack-tool";
  description = "Sends messages to Slack channels. Requires Slack integration to be connected.";

  schema = z.object({
    action: z.enum(["send-message"]).describe("The Slack action to perform."),
    channel: z.string().min(1).describe("The Slack channel ID or name to send the message to."),
    text: z.string().min(1).describe("The message text to send."),
  });

  protected async onCall(input: z.infer<typeof this.schema>): Promise<any> {
    const { action, channel, text } = input;
    const userId = this.userId;

    if (!userId) {
      return { error: "User ID not found for Slack tool." };
    }

    const integration = await getIntegration(userId, "slack");
    if (!integration || !integration.accessToken) {
      return { error: "Slack integration not found or not connected." };
    }

    const slackClient = new WebClient(integration.accessToken);

    try {
      switch (action) {
        case "send-message":
          const result = await slackClient.chat.postMessage({
            channel,
            text,
          });
          return { success: true, message: `Message sent to Slack channel ${channel}.`, ts: result.ts };

        default:
          return { error: "Invalid Slack action specified." };
      }
    } catch (e) {
      logger.error(`Slack tool error for action ${action}:`, e);
      return { error: `Slack tool failed for action ${action}. Details: ${e.message || e}` };
    }
  }
}
