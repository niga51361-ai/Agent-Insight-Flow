import { BaseTool } from "./base-tool";
import { z } from "zod";
import { getIntegration } from "@workspace/db";
import { Client } from "@notionhq/client";
import { logger } from "../../lib/logger";

export class NotionTool extends BaseTool {
  name = "notion-tool";
  description = "Manages Notion pages and databases. Requires Notion integration to be connected.";

  schema = z.object({
    action: z.enum(["create-page", "update-page", "get-page", "query-database"]).describe("The Notion action to perform."),
    databaseId: z.string().optional().describe("The ID of the Notion database. Required for query-database."),
    pageId: z.string().optional().describe("The ID of the Notion page. Required for get-page, update-page."),
    parentPageId: z.string().optional().describe("The ID of the parent page for a new page."),
    title: z.string().optional().describe("The title of the page. Required for create-page."),
    content: z.string().optional().describe("The content of the page. Required for create-page/update-page."),
    properties: z.record(z.any()).optional().describe("Properties for the page or database query. Optional."),
  });

  protected async onCall(input: z.infer<typeof this.schema>): Promise<any> {
    const { action, databaseId, pageId, parentPageId, title, content, properties } = input;
    const userId = this.userId;

    if (!userId) {
      return { error: "User ID not found for Notion tool." };
    }

    const integration = await getIntegration(userId, "notion");
    if (!integration || !integration.accessToken) {
      return { error: "Notion integration not found or not connected." };
    }

    const notion = new Client({
      auth: integration.accessToken,
    });

    try {
      switch (action) {
        case "create-page":
          if (!title) return { error: "title is required to create a page." };
          const createPageRes = await notion.pages.create({
            parent: parentPageId ? { page_id: parentPageId } : undefined,
            properties: {
              title: [
                {
                  text: {
                    content: title,
                  },
                },
              ],
              ...(properties || {}),
            },
            children: content ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content } }] } }] : undefined,
          });
          return { success: true, page: createPageRes };

        case "get-page":
          if (!pageId) return { error: "pageId is required to get a page." };
          const getPageRes = await notion.pages.retrieve({ page_id: pageId });
          return { success: true, page: getPageRes };

        case "update-page":
          if (!pageId) return { error: "pageId is required to update a page." };
          const updatePageRes = await notion.pages.update({
            page_id: pageId,
            properties,
          });
          return { success: true, page: updatePageRes };

        case "query-database":
          if (!databaseId) return { error: "databaseId is required to query a database." };
          const queryDbRes = await notion.databases.query({
            database_id: databaseId,
            filter: properties?.filter,
            sorts: properties?.sorts,
          });
          return { success: true, results: queryDbRes.results };

        default:
          return { error: "Invalid Notion action specified." };
      }
    } catch (e) {
      logger.error(`Notion tool error for action ${action}:`, e);
      return { error: `Notion tool failed for action ${action}. Details: ${e.message || e}` };
    }
  }
}
