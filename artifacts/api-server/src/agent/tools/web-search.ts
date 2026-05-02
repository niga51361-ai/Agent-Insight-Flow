import type { ToolDefinition, ToolResult } from "./types.js";

import { deductCredits } from "@workspace/db";

async function searchWeb(userId: string, query: string): Promise<ToolResult> {
  const WEB_SEARCH_COST = 0.005; // Example cost per web search
  const creditsDeducted = await deductCredits(userId, WEB_SEARCH_COST, `Web search: ${query.substring(0, 50)}`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for web search." };
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      no_html: "1",
      no_redirect: "1",
      skip_disambig: "1",
    });

    const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
      headers: { "User-Agent": "ZanixAgent/1.0" },
    });

    if (!res.ok) {
      return { success: false, output: null, error: `HTTP ${res.status}` };
    }

    const data = await res.json() as {
      Abstract?: string;
      AbstractSource?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      Results?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: Array<{ title: string; url: string; snippet: string }> = [];

    if (data.Abstract) {
      results.push({
        title: data.AbstractSource || "Direct Answer",
        url: data.AbstractURL || "",
        snippet: data.Abstract,
      });
    }

    if (data.Results) {
      for (const r of data.Results.slice(0, 3)) {
        if (r.Text && r.FirstURL) {
          results.push({ title: r.Text, url: r.FirstURL, snippet: r.Text });
        }
      }
    }

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] ?? topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      }
    }

    if (results.length === 0) {
      const serpParams = new URLSearchParams({
        q: query,
        format: "json",
        no_html: "1",
      });
      const serpRes = await fetch(
        `https://api.duckduckgo.com/?${serpParams}&kp=-1&kl=us-en`,
        { headers: { "User-Agent": "ZanixAgent/1.0" } }
      );
      if (serpRes.ok) {
        const d = await serpRes.json() as { RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
        for (const t of (d.RelatedTopics ?? []).slice(0, 5)) {
          if (t.Text && t.FirstURL) {
            results.push({ title: t.Text, url: t.FirstURL, snippet: t.Text });
          }
        }
      }
    }

    return {
      success: true,
      output: {
        query,
        results: results.slice(0, 8),
        resultCount: results.length,
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

export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web for information about any topic. Returns relevant results with titles, URLs, and snippets.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    query: {
      type: "string",
      description: "The search query to look up",
      required: true,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    return searchWeb(userId, String(params.query));
  },
};
