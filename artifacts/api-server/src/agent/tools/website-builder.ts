import type { ToolDefinition, ToolResult } from "./types.js";
import OpenAI from "openai";
import { deductCredits, getAgentPersonality, type AgentPersonality } from "@workspace/db";

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

interface WebsiteGenerationInput {
  userId: string;
  description: string;
  websiteType: string;
  pages?: string[];
  colorScheme?: string;
  includeFeatures?: string[];
  agentPersonality?: AgentPersonality;
}

async function buildWebsite(input: WebsiteGenerationInput): Promise<ToolResult> {
  try {
    const { userId, description, websiteType, pages = ["index"], colorScheme, includeFeatures = [], agentPersonality } = input;

    const LLM_COST_PER_TOKEN = 0.000002; // Example cost, adjust as needed for website generation

    const agentName = agentPersonality?.name || "Zanix AI";
    const agentDescription = agentPersonality?.description || "an expert full-stack web developer";
    const agentTone = agentPersonality?.tone || "professional and visually stunning";

    const systemPrompt = `You are ${agentName}, ${agentDescription}. Your tone is ${agentTone}.
Generate complete, standalone HTML files with embedded CSS and JavaScript.
Rules:
- Use modern CSS with variables, flexbox, and grid
- Make it fully responsive (mobile-first)
- Include beautiful animations and transitions
- Use semantic HTML5
- Make it professional and visually stunning
- All code must work without any external dependencies (use CDN links if needed)
- Include all pages requested as separate named sections or files
Return a JSON object with this structure:
{
  "files": [
    { "filename": "index.html", "content": "..." },
    { "filename": "style.css", "content": "..." },
    { "filename": "script.js", "content": "..." }
  ],
  "description": "Brief description of what was built",
  "features": ["list of included features"]
}`;

    const featuresText = includeFeatures.length > 0
      ? `\nRequired features: ${includeFeatures.join(", ")}`
      : "";

    const colorText = colorScheme ? `\nColor scheme: ${colorScheme}` : "";
    const pagesText = pages.length > 1 ? `\nPages to create: ${pages.join(", ")}` : "";

    const userPrompt = `Create a ${websiteType} website: ${description}${colorText}${pagesText}${featuresText}

Build a complete, professional, and visually stunning website. Make it look like it was designed by a top agency.`;

    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4); // Rough estimate
    const cost = estimatedTokens * LLM_COST_PER_TOKEN;

    const creditsDeducted = await deductCredits(userId, cost, `Website generation: ${websiteType} - ${description.substring(0, 50)}`);
    if (!creditsDeducted) {
      return { success: false, output: null, error: "Insufficient credits for website generation." };
    }

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: {
      files?: Array<{ filename: string; content: string }>;
      description?: string;
      features?: string[];
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        files: [{ filename: "index.html", content }],
        description: "Generated website",
        features: [],
      };
    }

    return {
      success: true,
      output: {
        websiteType,
        description,
        files: parsed.files ?? [],
        summary: parsed.description ?? "Website created successfully",
        features: parsed.features ?? [],
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

export const websiteBuilderTool: ToolDefinition = {
  name: "build_website",
  description:
    "Build a complete website from a description. Creates professional HTML, CSS, and JavaScript files. Can build landing pages, portfolios, e-commerce sites, blogs, dashboards, and more.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    description: {
      type: "string",
      description: "Detailed description of the website to build",
      required: true,
    },
    websiteType: {
      type: "string",
      description:
        "Type of website (e.g., landing page, portfolio, e-commerce, blog, dashboard, SaaS, restaurant)",
      required: true,
    },
    pages: {
      type: "array",
      description: "List of pages to create (e.g., ['index', 'about', 'contact'])",
      required: false,
      items: { type: "string" },
    },
    colorScheme: {
      type: "string",
      description: "Color scheme preference (e.g., 'dark blue and gold', 'minimal white')",
      required: false,
    },
    includeFeatures: {
      type: "array",
      description:
        "Features to include (e.g., ['contact form', 'testimonials', 'pricing table', 'FAQ', 'animations'])",
      required: false,
      items: { type: "string" },
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const agentPersonality = await getAgentPersonality(userId);
    return buildWebsite({
      userId,
      description: String(params.description),
      websiteType: String(params.websiteType),
      pages: Array.isArray(params.pages) ? params.pages.map(String) : ["index"],
      colorScheme: params.colorScheme ? String(params.colorScheme) : undefined,
      includeFeatures: Array.isArray(params.includeFeatures)
        ? params.includeFeatures.map(String)
        : [],
      agentPersonality,
    });
  },
};
