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

async function buildWebsite(
  description: string,
  websiteType: string,
  pages: string[],
  colorScheme: string | undefined,
  includeFeatures: string[]
): Promise<ToolResult> {
  try {
    const systemPrompt = `You are an expert full-stack web developer and UI/UX designer — Zanix AI's website generation engine.
Generate complete, standalone, production-ready websites.
Rules:
- Return ONLY valid JSON in the exact schema below — no explanations, no markdown
- Use modern CSS with custom properties (variables), flexbox, CSS Grid, and smooth animations
- Make it fully responsive — mobile-first design
- Include beautiful micro-interactions and transitions
- Use semantic HTML5 with proper accessibility attributes
- Make it look like it was designed by a top-tier design agency
- All code must work WITHOUT external dependencies unless using well-known CDN links (e.g., Google Fonts, Font Awesome)
- Use CSS animations over JavaScript when possible
- Include a proper color system with primary, secondary, and neutral colors

Return JSON with this EXACT structure:
{
  "files": [
    { "filename": "index.html", "content": "full HTML here" },
    { "filename": "style.css", "content": "full CSS here" },
    { "filename": "script.js", "content": "full JS here" }
  ],
  "description": "What was built",
  "features": ["feature1", "feature2"]
}`;

    const featuresText = includeFeatures.length > 0 ? `\nRequired features: ${includeFeatures.join(", ")}` : "";
    const colorText    = colorScheme ? `\nColor scheme: ${colorScheme}` : "";
    const pagesText    = pages.length > 1 ? `\nPages to create: ${pages.join(", ")}` : "";

    const userPrompt = `Create a ${websiteType} website: ${description}${colorText}${pagesText}${featuresText}

Build a complete, professional, visually stunning website. Make it look like it was designed by a top design agency with attention to every detail — typography, spacing, colors, animations, and user experience.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
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

    try { parsed = JSON.parse(content); }
    catch {
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
        fileCount: (parsed.files ?? []).length,
        summary: parsed.description ?? "Website created successfully",
        features: parsed.features ?? [],
        tokensUsed: response.usage?.total_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const websiteBuilderTool: ToolDefinition = {
  name: "build_website",
  description: "Build a complete, professional, agency-quality website from a description. Generates HTML, CSS, and JavaScript files with modern design, animations, and full responsiveness. Can build landing pages, portfolios, e-commerce sites, blogs, dashboards, SaaS sites, restaurants, and more.",
  parameters: {
    description: {
      type: "string",
      description: "Detailed description of the website to build — including purpose, audience, and any specific content",
      required: true,
    },
    websiteType: {
      type: "string",
      description: "Type of website (e.g., 'landing page', 'portfolio', 'e-commerce', 'blog', 'dashboard', 'SaaS', 'restaurant', 'agency')",
      required: true,
    },
    pages: {
      type: "array",
      description: "Pages to create (e.g., ['index', 'about', 'contact', 'pricing']). Default: ['index']",
      required: false,
      items: { type: "string" },
    },
    colorScheme: {
      type: "string",
      description: "Color scheme preference (e.g., 'dark purple and cyan', 'minimal white and black', 'warm earth tones')",
      required: false,
    },
    includeFeatures: {
      type: "array",
      description: "Features to include (e.g., ['contact form', 'testimonials', 'pricing table', 'FAQ section', 'smooth scroll', 'dark mode toggle'])",
      required: false,
      items: { type: "string" },
    },
  },
  execute: async (params) => {
    return buildWebsite(
      String(params.description),
      String(params.websiteType),
      Array.isArray(params.pages) ? params.pages.map(String) : ["index"],
      params.colorScheme ? String(params.colorScheme) : undefined,
      Array.isArray(params.includeFeatures) ? params.includeFeatures.map(String) : []
    );
  },
};
