import type { ToolDefinition, ToolResult } from "./types.js";

interface ZipEntry {
  name: string;
  size: number;
  isDirectory: boolean;
  content?: string;
}

function parseZip(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buf.length - 4) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) { offset++; continue; }

    const flags        = buf.readUInt16LE(offset + 6);
    const compression  = buf.readUInt16LE(offset + 8);
    const compSize     = buf.readUInt32LE(offset + 18);
    const uncompSize   = buf.readUInt32LE(offset + 22);
    const fnLen        = buf.readUInt16LE(offset + 26);
    const extraLen     = buf.readUInt16LE(offset + 28);

    if (flags & 0x01) { offset += 4; continue; }

    const nameStart = offset + 30;
    const nameEnd   = nameStart + fnLen;
    if (nameEnd > buf.length) break;

    const name = buf.slice(nameStart, nameEnd).toString("utf8");
    const dataStart = nameEnd + extraLen;
    const dataEnd   = dataStart + compSize;

    const isDir = name.endsWith("/");
    let content: string | undefined;

    if (!isDir && compression === 0 && uncompSize > 0 && uncompSize < 256 * 1024 && dataEnd <= buf.length) {
      const raw = buf.slice(dataStart, dataEnd);
      const text = raw.toString("utf8");
      const isText = !text.includes("\x00") && Array.from(text.slice(0, 200)).every(c => c.charCodeAt(0) < 128 || c.charCodeAt(0) > 159);
      if (isText) content = text.slice(0, 4000);
    }

    entries.push({ name, size: uncompSize, isDirectory: isDir, content });
    offset = dataEnd;
  }

  return entries;
}

const analyzeZipTool: ToolDefinition = {
  name: "analyze_zip",
  description: "List and analyze the contents of a ZIP file provided as base64. Can extract text files, code, and structured data from within the archive.",
  parameters: {
    base64: { type: "string", description: "Base64-encoded ZIP file content (can include data:... prefix)", required: true },
    filename: { type: "string", description: "Original ZIP filename for context", required: false },
    extract_text: { type: "string", description: "Set to 'true' to also extract text content of files (default: true)", required: false },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const b64 = String(params.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
      const buf  = Buffer.from(b64, "base64");
      const doExtract = String(params.extract_text ?? "true") !== "false";

      if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
        return { success: false, output: null, error: "ملف ZIP غير صالح أو تالف." };
      }

      const entries = parseZip(buf);
      if (entries.length === 0) {
        return { success: true, output: { filename: params.filename ?? "file.zip", entryCount: 0, entries: [], message: "الأرشيف فارغ." } };
      }

      const summary = entries.map(e => ({
        name: e.name,
        size: e.size,
        sizeHuman: e.size > 1024 * 1024 ? `${(e.size / 1024 / 1024).toFixed(1)}MB` : e.size > 1024 ? `${(e.size / 1024).toFixed(1)}KB` : `${e.size}B`,
        isDirectory: e.isDirectory,
        type: e.isDirectory ? "folder" : e.name.split(".").pop()?.toLowerCase() ?? "file",
        ...(doExtract && e.content ? { preview: e.content.slice(0, 800) } : {}),
      }));

      const fileCount = entries.filter(e => !e.isDirectory).length;
      const dirCount  = entries.filter(e => e.isDirectory).length;
      const totalSize = entries.reduce((a, e) => a + e.size, 0);
      const textFiles = entries.filter(e => !e.isDirectory && e.content);

      return {
        success: true,
        output: {
          filename: params.filename ?? "archive.zip",
          entryCount: entries.length,
          fileCount,
          dirCount,
          totalSizeBytes: totalSize,
          totalSizeHuman: totalSize > 1024 * 1024 ? `${(totalSize / 1024 / 1024).toFixed(1)}MB` : `${(totalSize / 1024).toFixed(1)}KB`,
          textFilesExtracted: textFiles.length,
          entries: summary,
          extractedContent: doExtract ? textFiles.slice(0, 10).map(e => ({ name: e.name, content: e.content })) : undefined,
        },
      };
    } catch (err) {
      return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export { analyzeZipTool };
