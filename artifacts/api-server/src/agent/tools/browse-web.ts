import type { ToolDefinition, ToolResult } from "./types.js";

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim()
    .slice(0, 12000);
}

async function browseUrl(url: string): Promise<ToolResult> {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { success: false, output: null, error: "Only HTTP/HTTPS URLs are supported." };
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(18000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZanixAgent/2.0; +https://zanix.ai)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") ?? "";
    let content: string;
    let title = "";

    if (contentType.includes("application/json")) {
      const json = await res.json();
      content = JSON.stringify(json, null, 2).slice(0, 12000);
    } else if (contentType.includes("text/")) {
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch?.[1]?.trim() ?? "";
      content = extractTextFromHtml(html);
    } else {
      return { success: false, output: null, error: `Unsupported content type: ${contentType}` };
    }

    return {
      success: true,
      output: {
        url,
        title,
        statusCode: res.status,
        contentType,
        content,
        contentLength: content.length,
        message: `Successfully fetched ${content.length} chars from ${url}`,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { success: false, output: null, error: "Request timed out after 18 seconds." };
    }
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const browseWebTool: ToolDefinition = {
  name: "browse_web",
  description: "Fetch and extract the full text content of any web page or URL. Use for reading articles, documentation, news, product pages, GitHub repos, Wikipedia, or any live URL. Returns clean text content.",
  parameters: {
    url: {
      type: "string",
      description: "Full URL to browse (must start with http:// or https://)",
      required: true,
    },
  },
  execute: async (params) => browseUrl(String(params.url)),
};
