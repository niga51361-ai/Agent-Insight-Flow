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

async function generateDiagram(
  description: string,
  diagramType: string
): Promise<ToolResult> {
  try {
    const typeInstructions: Record<string, string> = {
      flowchart: "Create a Mermaid flowchart (flowchart LR or TD) with nodes and arrows",
      sequence: "Create a Mermaid sequence diagram (sequenceDiagram) showing interactions between actors",
      mindmap: "Create a Mermaid mindmap starting with 'mindmap' and 'root'",
      gantt: "Create a Mermaid Gantt chart with tasks, sections, and dates",
      er: "Create a Mermaid ER diagram (erDiagram) with entities and relationships",
      pie: "Create a Mermaid pie chart with title and data values",
      class: "Create a Mermaid class diagram (classDiagram) with classes and relationships",
      chart_html: "Create a standalone HTML page with a Chart.js bar/line/pie chart (include CDN link)",
      svg: "Create an SVG diagram with shapes, text, and arrows directly in SVG markup",
    };

    const instruction = typeInstructions[diagramType] ?? typeInstructions.flowchart!;

    const systemPrompt = `You are an expert at creating technical diagrams and visualizations.
${instruction}.
Return ONLY the diagram code/markup, nothing else — no explanation, no markdown fences.
Make it comprehensive and professional.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create a ${diagramType} diagram for: ${description}` },
      ],
      max_completion_tokens: 2048,
    });

    const code = response.choices[0]?.message?.content?.trim() ?? "";

    const isMermaid = ["flowchart", "sequence", "mindmap", "gantt", "er", "pie", "class"].includes(diagramType);
    const isHtml = diagramType === "chart_html";
    const isSvg = diagramType === "svg";

    const renderHtml = isMermaid
      ? `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>body{background:#fff;display:flex;justify-content:center;padding:20px;font-family:sans-serif;}</style>
</head>
<body>
<div class="mermaid">${code}</div>
<script>mermaid.initialize({startOnLoad:true,theme:'default'});</script>
</body>
</html>`
      : isHtml
      ? code
      : isSvg
      ? `<!DOCTYPE html><html><body style="background:#fff;display:flex;justify-content:center;padding:20px;">${code}</body></html>`
      : code;

    return {
      success: true,
      output: {
        diagramType,
        description,
        code,
        renderHtml: renderHtml.substring(0, 20000),
        format: isMermaid ? "mermaid" : isHtml ? "html" : isSvg ? "svg" : "text",
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

export const diagramGeneratorTool: ToolDefinition = {
  name: "generate_diagram",
  description:
    "Generate professional diagrams and charts. Supports: Mermaid diagrams (flowchart, sequence, mindmap, gantt, er, pie, class), HTML Chart.js charts (chart_html), and SVG graphics. Returns diagram code and renderable HTML.",
  parameters: {
    description: {
      type: "string",
      description: "Detailed description of the diagram to create",
      required: true,
    },
    diagramType: {
      type: "string",
      description:
        "Diagram type: 'flowchart', 'sequence', 'mindmap', 'gantt', 'er', 'pie', 'class', 'chart_html', 'svg'",
      required: true,
    },
  },
  execute: async (params) => {
    return generateDiagram(String(params.description), String(params.diagramType));
  },
};
