import type { ToolDefinition, ToolResult } from "./types.js";
import { deductCredits } from "@workspace/db";

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > 8000) {
    text = text.substring(0, 8000) + "...[truncated]";
  }

  return text;
}

async function browseUrl(userId: string, url: string): Promise<ToolResult> {
  const BROWSE_WEB_COST = 0.01; // Example cost per web browse
  const creditsDeducted = await deductCredits(userId, BROWSE_WEB_COST, `Web browse: ${url.substring(0, 50)}`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for web browsing." };
  }

  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { success: false, output: null, error: "Only HTTP/HTTPS URLs supported" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ZanixAgent/1.0; +https://replit.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") ?? "";
    let content: string;

    if (contentType.includes("application/json")) {
      const json = await res.json();
      content = JSON.stringify(json, null, 2).substring(0, 8000);
    } else if (contentType.includes("text/")) {
      const html = await res.text();
      content = extractTextFromHtml(html);
    } else {
      return {
        success: false,
        output: null,
        error: `Unsupported content type: ${contentType}`,
      };
    }

    return {
      success: true,
      output: {
        url,
        statusCode: res.status,
        contentType,
        content,
        contentLength: content.length,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, output: null, error: "Request timed out after 15 seconds" };
    }
    return {
      success: false,
      output: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const browseWebTool: ToolDefinition = {
  name: "browse_web",
  description:
    "Navigate to a URL and extract the text content of the page. Useful for reading articles, documentation, or any web page. Returns the page content as text.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    url: {
      type: "string",
      description: "The full URL to browse (must start with http:// or https://)",
      required: true,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    return browseUrl(userId, String(params.url));
  },
};
