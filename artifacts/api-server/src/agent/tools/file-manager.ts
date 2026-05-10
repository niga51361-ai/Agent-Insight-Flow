import type { ToolDefinition, ToolResult } from "./types.js";
import { db } from "@workspace/db";
import { agentArtifactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const memoryStore = new Map<string, Array<{ id: string; name: string; content: string; artifactType: string; createdAt: Date }>>();

async function saveArtifact(
  taskId: string,
  name: string,
  content: string,
  artifactType: string
): Promise<ToolResult> {
  try {
    try {
      const [artifact] = await db
        .insert(agentArtifactsTable)
        .values({ taskId, artifactType, name, content, metadata: null })
        .returning();
      return {
        success: true,
        output: {
          id: artifact?.id,
          name,
          artifactType,
          contentLength: content.length,
          message: `✅ Artifact '${name}' saved successfully (${Math.round(content.length / 1024)}KB)`,
        },
      };
    } catch {
      const id = `mem-${taskId.slice(0, 8)}-${Date.now()}`;
      const entry = { id, name, content, artifactType, createdAt: new Date() };
      const existing = memoryStore.get(taskId) ?? [];
      const filtered = existing.filter(e => e.name !== name);
      filtered.push(entry);
      memoryStore.set(taskId, filtered);
      return {
        success: true,
        output: {
          id,
          name,
          artifactType,
          contentLength: content.length,
          message: `✅ Artifact '${name}' saved (${Math.round(content.length / 1024)}KB)`,
        },
      };
    }
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function listArtifacts(taskId: string): Promise<ToolResult> {
  try {
    try {
      const rows = await db
        .select({
          id: agentArtifactsTable.id,
          name: agentArtifactsTable.name,
          artifactType: agentArtifactsTable.artifactType,
          content: agentArtifactsTable.content,
          createdAt: agentArtifactsTable.createdAt,
        })
        .from(agentArtifactsTable)
        .where(eq(agentArtifactsTable.taskId, taskId));
      const artifacts = rows.map(r => ({
        id: r.id,
        name: r.name,
        artifactType: r.artifactType,
        contentLength: String(r.content).length,
        createdAt: r.createdAt,
      }));
      return { success: true, output: { artifacts, count: artifacts.length } };
    } catch {
      const mem = memoryStore.get(taskId) ?? [];
      const artifacts = mem.map(e => ({ id: e.id, name: e.name, artifactType: e.artifactType, contentLength: e.content.length, createdAt: e.createdAt }));
      return { success: true, output: { artifacts, count: artifacts.length } };
    }
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const saveFileTool: ToolDefinition = {
  name: "save_file",
  description: "Save generated content as a named file/artifact. Use to save code files, HTML pages, reports, JSON data, or any text content. Files are accessible via the artifacts API.",
  parameters: {
    name:         { type: "string", description: "Filename with extension (e.g., 'index.html', 'app.py', 'report.md')", required: true },
    content:      { type: "string", description: "The full file content to save", required: true },
    artifactType: { type: "string", description: "Type: 'html', 'css', 'javascript', 'python', 'typescript', 'markdown', 'json', 'text', 'code'", required: true },
  },
  execute: async (params) => {
    return saveArtifact(
      String(params.taskId ?? ""),
      String(params.name),
      String(params.content),
      String(params.artifactType ?? "text")
    );
  },
};

export const listFilesTool: ToolDefinition = {
  name: "list_files",
  description: "List all files/artifacts created for the current task.",
  parameters: {},
  execute: async (params) => {
    return listArtifacts(String(params.taskId ?? ""));
  },
};
