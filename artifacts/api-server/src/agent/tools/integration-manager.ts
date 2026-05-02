import { BaseTool } from "./base-tool";
import { z } from "zod";
import { createIntegration, deleteIntegration, getIntegration, listIntegrations } from "@workspace/db";
import { logger } from "../../lib/logger";

export class IntegrationManagerTool extends BaseTool {
  name = "integration-manager";
  description = "Manages external service integrations (connect/disconnect). Use this tool to connect to a new service or disconnect from an existing one.";

  schema = z.object({
    action: z.enum(["connect", "disconnect", "list", "status"]).describe("The action to perform: connect, disconnect, list, or status."),
    provider: z.string().optional().describe("The name of the service provider (e.g., 'github', 'google-drive', 'slack', 'notion'). Required for connect/disconnect/status."),
    accessToken: z.string().optional().describe("The access token for connecting to a service. Required for 'connect' action."),
    refreshToken: z.string().optional().describe("The refresh token for connecting to a service. Optional for 'connect' action."),
    expiresAt: z.string().datetime().optional().describe("The expiration date/time for the access token. Optional for 'connect' action."),
    config: z.record(z.any()).optional().describe("Additional configuration for the provider. Optional for 'connect' action."),
  });

  protected async onCall(input: z.infer<typeof this.schema>): Promise<any> {
    const { action, provider, accessToken, refreshToken, expiresAt, config } = input;
    const userId = this.userId; // Assuming userId is available from BaseTool

    if (!userId) {
      return { error: "User ID not found for integration management." };
    }

    switch (action) {
      case "connect":
        if (!provider || !accessToken) {
          return { error: "Provider and accessToken are required to connect." };
        }
        try {
          const existingIntegration = await getIntegration(userId, provider);
          if (existingIntegration) {
            // Update existing integration
            const updated = await createIntegration({
              userId,
              provider,
              accessToken,
              refreshToken,
              expiresAt: expiresAt ? new Date(expiresAt) : undefined,
              config,
            });
            return { success: true, message: `Successfully updated integration for ${provider}.` };
          } else {
            // Create new integration
            const newIntegration = await createIntegration({
              userId,
              provider,
              accessToken,
              refreshToken,
              expiresAt: expiresAt ? new Date(expiresAt) : undefined,
              config,
            });
            return { success: true, message: `Successfully connected to ${provider}.` };
          }
        } catch (e) {
          logger.error(`Error connecting to ${provider}:`, e);
          return { error: `Failed to connect to ${provider}.` };
        }

      case "disconnect":
        if (!provider) {
          return { error: "Provider is required to disconnect." };
        }
        try {
          const existingIntegration = await getIntegration(userId, provider);
          if (!existingIntegration) {
            return { error: `No active integration found for ${provider}.` };
          }
          const deleted = await deleteIntegration(existingIntegration.id);
          if (deleted) {
            return { success: true, message: `Successfully disconnected from ${provider}.` };
          } else {
            return { error: `Failed to disconnect from ${provider}.` };
          }
        } catch (e) {
          logger.error(`Error disconnecting from ${provider}:`, e);
          return { error: `Failed to disconnect from ${provider}.` };
        }

      case "list":
        try {
          const integrations = await listIntegrations(userId);
          return { success: true, integrations: integrations.map(int => ({ id: int.id, provider: int.provider, connectedAt: int.createdAt })) };
        } catch (e) {
          logger.error("Error listing integrations:", e);
          return { error: "Failed to list integrations." };
        }

      case "status":
        if (!provider) {
          return { error: "Provider is required to check status." };
        }
        try {
          const integration = await getIntegration(userId, provider);
          if (integration) {
            return { success: true, status: "connected", provider: integration.provider, expiresAt: integration.expiresAt };
          } else {
            return { success: true, status: "disconnected", provider };
          }
        } catch (e) {
          logger.error(`Error checking status for ${provider}:`, e);
          return { error: `Failed to check status for ${provider}.` };
        }

      default:
        return { error: "Invalid action specified." };
    }
  }
}
