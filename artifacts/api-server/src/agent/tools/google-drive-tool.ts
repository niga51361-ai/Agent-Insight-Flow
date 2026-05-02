import { BaseTool } from "./base-tool";
import { z } from "zod";
import { getIntegration } from "@workspace/db";
import { google } from "googleapis";
import { logger } from "../../lib/logger";

export class GoogleDriveTool extends BaseTool {
  name = "google-drive-tool";
  description = "Manages Google Drive files and folders. Requires Google Drive integration to be connected.";

  schema = z.object({
    action: z.enum(["list-files", "get-file-content", "create-file", "update-file", "delete-file"]).describe("The Google Drive action to perform."),
    fileId: z.string().optional().describe("The ID of the file. Required for get-file-content, update-file, delete-file."),
    fileName: z.string().optional().describe("The name of the file. Required for create-file."),
    folderId: z.string().optional().describe("The ID of the folder to list/create files in."),
    content: z.string().optional().describe("The content of the file. Required for create-file/update-file."),
    mimeType: z.string().optional().describe("The MIME type of the file. Optional for create-file."),
  });

  protected async onCall(input: z.infer<typeof this.schema>): Promise<any> {
    const { action, fileId, fileName, folderId, content, mimeType } = input;
    const userId = this.userId;

    if (!userId) {
      return { error: "User ID not found for Google Drive tool." };
    }

    const integration = await getIntegration(userId, "google-drive");
    if (!integration || !integration.accessToken) {
      return { error: "Google Drive integration not found or not connected." };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiresAt?.getTime(),
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    try {
      switch (action) {
        case "list-files":
          const listFilesRes = await drive.files.list({
            q: folderId ? `'${folderId}' in parents` : undefined,
            fields: "files(id, name, mimeType)",
          });
          return { success: true, files: listFilesRes.data.files };

        case "get-file-content":
          if (!fileId) return { error: "fileId is required to get file content." };
          const fileContentRes = await drive.files.get({
            fileId,
            alt: "media",
          }, { responseType: "stream" });
          let fileContent = "";
          await new Promise((resolve, reject) => {
            fileContentRes.data
              .on("data", (chunk: Buffer) => (fileContent += chunk.toString()))
              .on("end", resolve)
              .on("error", reject);
          });
          return { success: true, content: fileContent };

        case "create-file":
          if (!fileName || !content) return { error: "fileName and content are required to create a file." };
          const createFileRes = await drive.files.create({
            requestBody: {
              name: fileName,
              parents: folderId ? [folderId] : undefined,
              mimeType: mimeType || "text/plain",
            },
            media: {
              mimeType: mimeType || "text/plain",
              body: content,
            },
          });
          return { success: true, file: createFileRes.data };

        case "update-file":
          if (!fileId || !content) return { error: "fileId and content are required to update a file." };
          const updateFileRes = await drive.files.update({
            fileId,
            media: {
              mimeType: mimeType || "text/plain",
              body: content,
            },
          });
          return { success: true, file: updateFileRes.data };

        case "delete-file":
          if (!fileId) return { error: "fileId is required to delete a file." };
          await drive.files.delete({ fileId });
          return { success: true, message: `File ${fileId} deleted.` };

        default:
          return { error: "Invalid Google Drive action specified." };
      }
    } catch (e) {
      logger.error(`Google Drive tool error for action ${action}:`, e);
      return { error: `Google Drive tool failed for action ${action}. Details: ${e.message || e}` };
    }
  }
}
