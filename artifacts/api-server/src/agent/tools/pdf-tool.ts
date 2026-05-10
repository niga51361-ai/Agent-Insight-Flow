import type { ToolDefinition, ToolResult } from "./types.js";

function buildPdf(title: string, lines: string[]): Buffer {
  const textObjects: string[] = [];
  let y = 750;
  const lineHeight = 16;
  const leftX = 50;
  let pageCount = 1;

  const allLines: string[] = [];
  for (const line of lines) {
    if (line.length <= 80) { allLines.push(line); continue; }
    const words = line.split(" ");
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).length > 80) { if (cur) allLines.push(cur); cur = w; }
      else { cur = cur ? cur + " " + w : w; }
    }
    if (cur) allLines.push(cur);
  }

  for (const line of allLines) {
    if (y < 60) { y = 750; pageCount++; }
    const safe = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    textObjects.push(`${leftX} ${y} Td (${safe}) Tj 0 -${lineHeight} Td`);
    y -= lineHeight;
  }

  const titleSafe = title.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const streamContent = `BT /F2 16 Tf ${leftX} 780 Td (${titleSafe}) Tj 0 -30 Td /F1 11 Tf ${textObjects.join("\n")} ET`;
  const streamBytes = Buffer.from(streamContent, "latin1");

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842]\n   /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >>\n   /Contents 6 0 R >>\nendobj`);
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj");
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj");
  objects.push(`6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream\nendobj`);

  let offset = 9;
  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  const parts: string[] = [header];

  for (const obj of objects) {
    offsets.push(offset);
    parts.push(obj + "\n");
    offset += Buffer.byteLength(obj + "\n", "latin1");
  }

  const xrefOffset = offset;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (const o of offsets) xref.push(String(o).padStart(10, "0") + " 00000 n ");
  xref.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`);
  xref.push(`startxref\n${xrefOffset}\n%%EOF`);
  parts.push(xref.join("\n"));

  return Buffer.from(parts.join(""), "latin1");
}

function extractTextFromPdf(base64: string): string {
  try {
    const buf = Buffer.from(base64, "base64");
    const raw = buf.toString("latin1");
    const texts: string[] = [];
    const tjRegex = /\(([^)]{1,400})\)\s*T[jJ]/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(raw)) !== null) {
      const t = m[1]
        .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ")
        .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
        .replace(/[^\x20-\x7E\n\t\u0600-\u06FF]/g, " ").trim();
      if (t.length > 2) texts.push(t);
    }
    const bjfRegex = /BT([\s\S]{1,2000}?)ET/g;
    while ((m = bjfRegex.exec(raw)) !== null) {
      const block = m[1];
      const inner = /\[((?:[^[\]]*?\([^)]*?\)[^[\]]*?)+)\]\s*TJ/g;
      let im: RegExpExecArray | null;
      while ((im = inner.exec(block)) !== null) {
        const t2 = im[1].replace(/\([^)]*?\)/g, s => s.slice(1, -1)).replace(/[^\x20-\x7E\u0600-\u06FF\n]/g, " ").trim();
        if (t2.length > 2 && !texts.includes(t2)) texts.push(t2);
      }
    }
    if (texts.length === 0) return "لم يتم استخراج نص. ملف PDF ربما مشفّر أو يعتمد على صور/خطوط مخصصة.";
    return texts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "تعذّر تحليل الملف.";
  }
}

const createPdfTool: ToolDefinition = {
  name: "create_pdf",
  description: "Create a PDF file from text content and return it as base64. Use for reports, documents, and formatted text output.",
  parameters: {
    title: { type: "string", description: "Document title", required: true },
    content: { type: "string", description: "Text content for the PDF (use \\n for line breaks)", required: true },
    filename: { type: "string", description: "Output filename (without .pdf)", required: false },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const title = String(params.title ?? "Document");
      const content = String(params.content ?? "");
      const filename = String(params.filename ?? "document") + ".pdf";
      const lines = content.replace(/\r/g, "").split("\n");
      const pdfBuffer = buildPdf(title, lines);
      const base64 = pdfBuffer.toString("base64");
      return {
        success: true,
        output: {
          filename,
          base64,
          sizeBytes: pdfBuffer.length,
          pages: 1,
          message: `✅ تم إنشاء PDF "${filename}" (${Math.round(pdfBuffer.length / 1024)}KB). يمكنك تحميله.`,
          downloadUrl: `data:application/pdf;base64,${base64}`,
        },
      };
    } catch (err) {
      return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

const readPdfTool: ToolDefinition = {
  name: "read_pdf",
  description: "Extract text content from a PDF file provided as base64 string. Use when user uploads or provides a PDF.",
  parameters: {
    base64: { type: "string", description: "Base64-encoded PDF file content", required: true },
    filename: { type: "string", description: "Original filename for context", required: false },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const b64 = String(params.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
      const text = extractTextFromPdf(b64);
      return {
        success: true,
        output: {
          extractedText: text,
          charCount: text.length,
          filename: params.filename ?? "document.pdf",
        },
      };
    } catch (err) {
      return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export { createPdfTool, readPdfTool };
