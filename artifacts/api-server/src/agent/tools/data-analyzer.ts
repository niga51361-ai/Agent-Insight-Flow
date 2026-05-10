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

async function analyzeData(data: string, question: string, outputFormat: string): Promise<ToolResult> {
  try {
    const systemPrompt = `You are Zanix AI's data analysis engine — an expert data analyst, statistician, and business intelligence specialist.
Analyze the provided data and answer the question accurately and thoroughly.
Output format: ${outputFormat}
- 'json': Return structured JSON with: {"findings": [...], "insights": [...], "statistics": {...}, "conclusion": "..."}
- 'table': Return a well-formatted markdown table with organized data.
- 'narrative': Write a clear, insightful analytical paragraph with supporting evidence.
- 'bullets': Use bullet points for key findings and patterns.
Always include: trends, patterns, anomalies, statistics (min/max/avg if applicable), and actionable insights.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Data to analyze:\n\`\`\`\n${data.substring(0, 10000)}\n\`\`\`\n\nQuestion/Task: ${question}` },
      ],
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content ?? "";

    let parsedOutput: unknown = content;
    if (outputFormat === "json") {
      try { parsedOutput = JSON.parse(content); }
      catch { parsedOutput = content; }
    }

    return {
      success: true,
      output: {
        analysis: parsedOutput,
        question,
        outputFormat,
        dataLength: data.length,
        dataLines: data.split("\n").length,
        tokensUsed: response.usage?.total_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const dataAnalyzerTool: ToolDefinition = {
  name: "analyze_data",
  description: "Analyze any structured or unstructured data — JSON, CSV, tables, numbers, text datasets — to extract insights, patterns, statistics, trends, and anomalies. Answer specific questions about data or perform exploratory analysis.",
  parameters: {
    data:         { type: "string", description: "The data to analyze (JSON, CSV, plain text, numbers, markdown table, etc.)", required: true },
    question:     { type: "string", description: "Specific question or analysis task (e.g., 'What are the top trends?', 'Summarize key metrics')", required: true },
    outputFormat: { type: "string", description: "Output format: 'json' | 'table' | 'narrative' | 'bullets' (default: bullets)", required: false },
  },
  execute: async (params) => {
    return analyzeData(
      String(params.data),
      String(params.question),
      String(params.outputFormat ?? "bullets")
    );
  },
};
