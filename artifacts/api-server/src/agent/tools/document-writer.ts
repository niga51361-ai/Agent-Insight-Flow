import type { ToolDefinition, ToolResult } from "./types.js";
import OpenAI from "openai";

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

async function writeDocument(
  title: string,
  topic: string,
  documentType: string,
  language: string,
  length: string,
  outline?: string
): Promise<ToolResult> {
  try {
    const typeInstructions: Record<string, string> = {
      report: "Write a comprehensive professional report with Executive Summary, Introduction, Analysis, Findings, Recommendations, and Conclusion.",
      article: "Write a well-structured article with engaging intro, multiple sections with subheadings, and conclusion.",
      proposal: "Write a business proposal with Executive Summary, Problem Statement, Proposed Solution, Timeline, Budget, and Expected ROI.",
      email: "Write a professional email with subject line, greeting, body paragraphs, and closing.",
      readme: "Write a detailed README.md file with badges, description, features, installation, usage, API docs, and contributing section.",
      essay: "Write a formal essay with thesis, supporting arguments, evidence, counterarguments, and conclusion.",
      tutorial: "Write a step-by-step tutorial with prerequisites, numbered steps, code examples, and troubleshooting tips.",
      plan: "Write a detailed action plan with goals, milestones, tasks, timeline, resources, and success metrics.",
      summary: "Write a concise executive summary capturing key points, findings, and recommendations.",
      press_release: "Write a formal press release with headline, dateline, lead paragraph, body, boilerplate, and contact info.",
    };

    const lengthGuide: Record<string, string> = {
      short: "500-800 words",
      medium: "1000-1500 words",
      long: "2000-3000 words",
      detailed: "3000-5000 words",
    };

    const instruction = typeInstructions[documentType] ?? typeInstructions.report!;
    const wordCount = lengthGuide[length] ?? lengthGuide.medium!;
    const outlineSection = outline ? `\n\nOutline/Structure to follow:\n${outline}` : "";

    const systemPrompt = `You are an expert professional writer and content specialist.
${instruction}
Write in ${language}. Target length: ${wordCount}.
Use proper formatting with headers (##), bullet points, bold text where appropriate.
Make it professional, clear, and comprehensive.${outlineSection}`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Title: ${title}\n\nTopic/Requirements: ${topic}` },
      ],
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content ?? "";

    const htmlContent = `<!DOCTYPE html>
<html lang="${language === "Arabic" ? "ar" : "en"}" ${language === "Arabic" ? 'dir="rtl"' : ""}>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #333; }
  h1 { border-bottom: 3px solid #2563eb; padding-bottom: 10px; color: #1e40af; }
  h2 { color: #1e40af; margin-top: 30px; }
  h3 { color: #374151; }
  p { margin: 12px 0; text-align: ${language === "Arabic" ? "right" : "justify"}; }
  ul, ol { padding-left: ${language === "Arabic" ? "0" : "20px"}; padding-right: ${language === "Arabic" ? "20px" : "0"}; }
  strong { color: #1e40af; }
  blockquote { border-left: 4px solid #2563eb; margin: 0; padding-left: 20px; color: #555; font-style: italic; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  pre { background: #1e293b; color: #e2e8f0; padding: 20px; border-radius: 8px; overflow-x: auto; }
  .meta { color: #6b7280; font-size: 0.9em; margin-bottom: 30px; }
</style>
</head>
<body>
<p class="meta">Generated: ${new Date().toLocaleDateString()} | Type: ${documentType} | Language: ${language}</p>
${content.replace(/\n/g, "<br>").replace(/##\s(.+)/g, "<h2>$1</h2>").replace(/###\s(.+)/g, "<h3>$1</h3>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}
</body>
</html>`;

    return {
      success: true,
      output: {
        title,
        documentType,
        language,
        length,
        markdownContent: content,
        htmlContent,
        wordCount: content.split(/\s+/).length,
        tokensUsed: response.usage?.total_tokens ?? 0,
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

export const documentWriterTool: ToolDefinition = {
  name: "write_document",
  description:
    "Write complete professional documents: reports, articles, proposals, emails, README files, essays, tutorials, plans, summaries, and press releases. Supports any language. Returns both Markdown and HTML versions.",
  parameters: {
    title: {
      type: "string",
      description: "Document title",
      required: true,
    },
    topic: {
      type: "string",
      description: "Detailed topic, subject matter, or requirements for the document",
      required: true,
    },
    documentType: {
      type: "string",
      description:
        "Document type: 'report', 'article', 'proposal', 'email', 'readme', 'essay', 'tutorial', 'plan', 'summary', 'press_release'",
      required: true,
    },
    language: {
      type: "string",
      description: "Language for the document (e.g., 'Arabic', 'English', 'French')",
      required: false,
    },
    length: {
      type: "string",
      description: "Document length: 'short' (500-800w), 'medium' (1000-1500w), 'long' (2000-3000w), 'detailed' (3000-5000w)",
      required: false,
    },
    outline: {
      type: "string",
      description: "Optional outline or structure to follow",
      required: false,
    },
  },
  execute: async (params) => {
    return writeDocument(
      String(params.title),
      String(params.topic),
      String(params.documentType),
      String(params.language ?? "English"),
      String(params.length ?? "medium"),
      params.outline ? String(params.outline) : undefined
    );
  },
};
