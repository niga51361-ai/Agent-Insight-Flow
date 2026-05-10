import type { ToolDefinition, ToolResult } from "./types.js";

async function searchWithSerper(query: string, apiKey: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 8, gl: "ar", hl: "ar" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json() as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    answerBox?: { answer?: string; snippet?: string; title?: string; link?: string };
    knowledgeGraph?: { title?: string; description?: string };
  };
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  if (data.answerBox) {
    results.push({
      title: data.answerBox.title ?? "إجابة مباشرة",
      url: data.answerBox.link ?? "",
      snippet: data.answerBox.answer ?? data.answerBox.snippet ?? "",
    });
  }
  if (data.knowledgeGraph?.description) {
    results.push({
      title: data.knowledgeGraph.title ?? query,
      url: "",
      snippet: data.knowledgeGraph.description,
    });
  }
  for (const r of data.organic ?? []) {
    if (r.title && r.link) {
      results.push({ title: r.title, url: r.link, snippet: r.snippet ?? "" });
    }
  }
  return results.slice(0, 8);
}

async function searchWithDuckDuckGo(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const params = new URLSearchParams({ q: query, format: "json", no_html: "1", no_redirect: "1", skip_disambig: "1" });
  const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
    headers: { "User-Agent": "Mozilla/5.0 ZanixAgent/2.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const data = await res.json() as {
    Abstract?: string; AbstractSource?: string; AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
    Results?: Array<{ Text?: string; FirstURL?: string }>;
    Answer?: string;
  };
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  if (data.Answer) results.push({ title: "إجابة مباشرة", url: "", snippet: data.Answer });
  if (data.Abstract) results.push({ title: data.AbstractSource ?? "ملخص", url: data.AbstractURL ?? "", snippet: data.Abstract });
  for (const r of data.Results ?? []) {
    if (r.Text && r.FirstURL) results.push({ title: r.Text.split(" - ")[0] ?? r.Text, url: r.FirstURL, snippet: r.Text });
  }
  for (const t of data.RelatedTopics ?? []) {
    if (t.Text && t.FirstURL) results.push({ title: t.Text.split(" - ")[0] ?? t.Text, url: t.FirstURL, snippet: t.Text });
    for (const sub of t.Topics ?? []) {
      if (sub.Text && sub.FirstURL) results.push({ title: sub.Text.split(" - ")[0] ?? sub.Text, url: sub.FirstURL, snippet: sub.Text });
    }
  }
  return results.slice(0, 8);
}

async function searchWeb(query: string): Promise<ToolResult> {
  try {
    const serperKey = process.env["SERPER_API_KEY"];
    let results: Array<{ title: string; url: string; snippet: string }> = [];

    if (serperKey) {
      results = await searchWithSerper(query, serperKey);
    } else {
      results = await searchWithDuckDuckGo(query);
      if (results.length < 2) {
        const fallback = await searchWithDuckDuckGo(`${query} site:wikipedia.org OR site:github.com`).catch(() => []);
        results = [...results, ...fallback].slice(0, 8);
      }
    }

    if (results.length === 0) {
      return { success: true, output: { query, results: [], resultCount: 0, message: "لم يتم العثور على نتائج. حاول صياغة مختلفة." } };
    }

    return { success: true, output: { query, results, resultCount: results.length, engine: serperKey ? "Serper/Google" : "DuckDuckGo" } };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description: "Search the web for real-time information, news, prices, or any topic. Returns titles, URLs, and snippets from search results.",
  parameters: {
    query: { type: "string", description: "The search query", required: true },
  },
  execute: async (params) => searchWeb(String(params.query)),
};
