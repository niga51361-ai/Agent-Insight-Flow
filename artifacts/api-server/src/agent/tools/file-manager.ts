import type { ToolDefinition, ToolResult } from "./types.js";
import { db, deductCredits } from "@workspace/db";
import { agentArtifactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function saveArtifact(
  userId: string,
  taskId: string,
  name: string,
  content: string,
  artifactType: string,
  metadata?: Record<string, unknown>
): Promise<ToolResult> {
  const FILE_STORAGE_COST_PER_CHAR = 0.00000001; // Example cost per character, adjust as needed
  const cost = content.length * FILE_STORAGE_COST_PER_CHAR;

  const creditsDeducted = await deductCredits(userId, cost, `File storage: ${name} (${artifactType})`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for file storage." };
  }

  try {
    const [artifact] = await db
      .insert(agentArtifactsTable)
      .values({
        taskId,
        artifactType,
        name,
        content,
        metadata: metadata ?? null,
      })
      .returning();

    return {
      success: true,
      output: {
        id: artifact?.id,
        name,
        artifactType,
        contentLength: content.length,
        message: `Artifact '${name}' saved successfully`,
      },
    };
  } catch (err) {
    return {
      success: false,
      output: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function listArtifacts(taskId: string): Promise<ToolResult> {
  try {
    const artifacts = await db
      .select({
        id: agentArtifactsTable.id,
        name: agentArtifactsTable.name,
        artifactType: agentArtifactsTable.artifactType,
        contentLength: agentArtifactsTable.content,
        createdAt: agentArtifactsTable.createdAt,
      })
      .from(agentArtifactsTable)
      .where(eq(agentArtifactsTable.taskId, taskId));

    return {
      success: true,
      output: {
        artifacts: artifacts.map((a) => ({
          ...a,
          contentLength: String(a.contentLength).length,
        })),
        count: artifacts.length,
      },
    };
  } catch (err) {
    return {
      success: false,
      output: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const saveFileTool: ToolDefinition = {
  name: "save_file",
  description:
    "Save content as a file/artifact for the current task. Files are persisted and can be retrieved later. Use for saving generated code, documents, websites, and any other output.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    taskId: {
      type: "string",
      description: "The task ID this file belongs to",
      required: true,
    },
    name: {
      type: "string",
      description: "Filename with extension (e.g., \'index.html\', \'app.py\', \'report.md\')",
      required: true,
    },
    content: {
      type: "string",
      description: "The file content to save",
      required: true,
    },
    artifactType: {
      type: "string",
      description:
        "Type of artifact: \'code\', \'html\', \'css\', \'javascript\', \'markdown\', \'json\', \'text\', \'website\'",
      required: true,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    return saveArtifact(
      userId,
      String(params.taskId),
      String(params.name),
      String(params.content),
      String(params.artifactType)
    );
  },
};

export const listFilesTool: ToolDefinition = {
  name: "list_files",
  description: "List all files/artifacts created for a task.",
  parameters: {
    taskId: {
      type: "string",
      description: "The task ID to list artifacts for",
      required: true,
    },
  },
  execute: async (params) => {
    return listArtifacts(String(params.taskId));
  },
};
