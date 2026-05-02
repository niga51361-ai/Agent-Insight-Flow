import type { ToolDefinition, ToolResult } from "./types.js";
import { deductCredits } from "@workspace/db";

async function makeHttpRequest(
  userId: string,
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number
): Promise<ToolResult> {
  const HTTP_REQUEST_COST = 0.001; // Example cost per HTTP request
  const creditsDeducted = await deductCredits(userId, HTTP_REQUEST_COST, `HTTP request: ${method} ${url.substring(0, 50)}`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for HTTP request." };
  }

  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { success: false, output: null, error: "Only HTTP/HTTPS URLs are allowed" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "User-Agent": "ZanixAgent/1.0",
        ...headers,
      },
      signal: controller.signal,
      redirect: "follow",
    };

    if (body && !["GET", "HEAD"].includes(method.toUpperCase())) {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const contentType = response.headers.get("content-type") ?? "";
    let responseBody: unknown;

    if (contentType.includes("application/json")) {
      responseBody = await response.json();
    } else {
      const text = await response.text();
      responseBody = text.substring(0, 10000);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

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
      },
      ...(!response.ok && { error: `HTTP ${response.status}: ${response.statusText}` }),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, output: null, error: `Request timed out after ${timeoutMs}ms` };
    }
    return {
      success: false,
      output: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const httpClientTool: ToolDefinition = {
  name: "http_request",
  description:
    "Make HTTP requests to any external API or web service. Supports GET, POST, PUT, PATCH, DELETE methods with custom headers and body. Use this to interact with REST APIs, fetch data from services, or send data to external endpoints.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    url: {
      type: "string",
      description: "The full URL to make the request to",
      required: true,
    },
    method: {
      type: "string",
      description: "HTTP method: GET, POST, PUT, PATCH, DELETE (default: GET)",
      required: false,
    },
    headers: {
      type: "object",
      description:
        'Request headers as key-value pairs (e.g., {"Authorization": "Bearer token", "Content-Type": "application/json"})',
      required: false,
    },
    body: {
      type: "string",
      description: "Request body (as JSON string or plain text) for POST/PUT/PATCH requests",
      required: false,
    },
    timeout: {
      type: "number",
      description: "Timeout in milliseconds (default: 15000)",
      required: false,
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const headers: Record<string, string> =
      typeof params.headers === "object" && params.headers !== null
        ? Object.fromEntries(
            Object.entries(params.headers as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        : {};

    return makeHttpRequest(
      userId,
      String(params.url),
      String(params.method ?? "GET"),
      headers,
      params.body ? String(params.body) : undefined,
      Number(params.timeout ?? 15000)
    );
  },
};
