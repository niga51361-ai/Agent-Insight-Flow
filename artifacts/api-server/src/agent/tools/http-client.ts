import type { ToolDefinition, ToolResult } from "./types.js";

async function makeHttpRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number
): Promise<ToolResult> {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { success: false, output: null, error: "Only HTTP/HTTPS URLs are allowed." };
    }

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: { "User-Agent": "ZanixAgent/2.0", ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    };

    if (body && !["GET", "HEAD"].includes(method.toUpperCase())) {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type") ?? "";
    let responseBody: unknown;

    if (contentType.includes("application/json")) {
      try { responseBody = await response.json(); }
      catch { responseBody = await response.text(); }
    } else {
      responseBody = (await response.text()).slice(0, 10000);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    return {
      success: response.ok,
      output: {
        url,
        method: method.toUpperCase(),
        statusCode: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        ok: response.ok,
        contentType,
      },
      ...(!response.ok ? { error: `HTTP ${response.status}: ${response.statusText}` } : {}),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { success: false, output: null, error: `Request timed out after ${timeoutMs}ms` };
    }
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const httpClientTool: ToolDefinition = {
  name: "http_request",
  description: "Make HTTP requests to any REST API or web service. Supports GET, POST, PUT, PATCH, DELETE with custom headers and body. Use to interact with external APIs, webhooks, or data services. Returns status code, headers, and response body.",
  parameters: {
    url:     { type: "string", description: "Full URL to call (http:// or https://)", required: true },
    method:  { type: "string", description: "HTTP method: GET, POST, PUT, PATCH, DELETE (default: GET)", required: false },
    headers: { type: "object", description: 'Custom headers as JSON (e.g. {"Authorization":"Bearer TOKEN","Content-Type":"application/json"})', required: false },
    body:    { type: "string", description: "Request body for POST/PUT/PATCH — JSON string or plain text", required: false },
    timeout: { type: "number", description: "Timeout in ms (default: 15000, max: 30000)", required: false },
  },
  execute: async (params) => {
    const headers: Record<string, string> =
      typeof params.headers === "object" && params.headers !== null
        ? Object.fromEntries(Object.entries(params.headers as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
        : {};
    return makeHttpRequest(
      String(params.url),
      String(params.method ?? "GET"),
      headers,
      params.body ? String(params.body) : undefined,
      Math.min(Number(params.timeout ?? 15000), 30000)
    );
  },
};
