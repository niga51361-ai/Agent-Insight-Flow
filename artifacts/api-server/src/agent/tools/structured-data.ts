import type { ToolDefinition, ToolResult } from "./types.js";

function parseCSV(csvText: string): Array<Record<string, string>> {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of lines[i]!) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.replace(/^"|"$/g, "") ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function computeStats(values: number[]): Record<string, number> {
  if (values.length === 0) return {};
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
    : sorted[Math.floor(sorted.length / 2)]!;

  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;

  return {
    count: values.length,
    sum: Math.round(sum * 1000) / 1000,
    mean: Math.round(mean * 1000) / 1000,
    median: Math.round(median * 1000) / 1000,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    stdDev: Math.round(Math.sqrt(variance) * 1000) / 1000,
  };
}

function processData(
  data: string,
  format: string,
  operation: string,
  filters?: Record<string, string>,
  groupBy?: string,
  columns?: string[]
): ToolResult {
  try {
    let parsed: Array<Record<string, unknown>> = [];

    if (format === "csv") {
      parsed = parseCSV(data);
    } else if (format === "json") {
      const raw = JSON.parse(data) as unknown;
      if (Array.isArray(raw)) {
        parsed = raw as Array<Record<string, unknown>>;
      } else if (typeof raw === "object" && raw !== null) {
        const dataKey = Object.keys(raw as object).find((k) =>
          Array.isArray((raw as Record<string, unknown>)[k])
        );
        if (dataKey) {
          parsed = (raw as Record<string, unknown[]>)[dataKey] as Array<Record<string, unknown>>;
        } else {
          parsed = [raw as Record<string, unknown>];
        }
      }
    } else {
      return { success: false, output: null, error: "Unsupported format. Use 'csv' or 'json'." };
    }

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        parsed = parsed.filter((row) => String(row[key] ?? "").toLowerCase().includes(value.toLowerCase()));
      }
    }

    const selectedColumns = columns && columns.length > 0 ? columns : undefined;
    if (selectedColumns) {
      parsed = parsed.map((row) => {
        const newRow: Record<string, unknown> = {};
        for (const col of selectedColumns) {
          newRow[col] = row[col];
        }
        return newRow;
      });
    }

    if (operation === "summary") {
      const schema = Object.keys(parsed[0] ?? {});
      const numericStats: Record<string, Record<string, number>> = {};

      for (const col of schema) {
        const nums = parsed
          .map((row) => parseFloat(String(row[col] ?? "")))
          .filter((n) => !isNaN(n));
        if (nums.length > parsed.length * 0.5) {
          numericStats[col] = computeStats(nums);
        }
      }

      return {
        success: true,
        output: {
          operation: "summary",
          rowCount: parsed.length,
          columns: schema,
          numericStats,
          sampleRows: parsed.slice(0, 5),
        },
      };
    }

    if (operation === "group_by" && groupBy) {
      const groups: Record<string, Array<Record<string, unknown>>> = {};
      for (const row of parsed) {
        const key = String(row[groupBy] ?? "");
        if (!groups[key]) groups[key] = [];
        groups[key]!.push(row);
      }

      const groupSummary = Object.entries(groups).map(([key, rows]) => ({
        group: key,
        count: rows.length,
        rows: rows.slice(0, 3),
      }));

      return {
        success: true,
        output: {
          operation: "group_by",
          groupBy,
          groups: groupSummary,
          totalGroups: groupSummary.length,
          totalRows: parsed.length,
        },
      };
    }

    if (operation === "filter") {
      return {
        success: true,
        output: {
          operation: "filter",
          filters,
          matchedRows: parsed.length,
          data: parsed.slice(0, 100),
        },
      };
    }

    return {
      success: true,
      output: {
        operation: operation || "read",
        rowCount: parsed.length,
        columns: Object.keys(parsed[0] ?? {}),
        data: parsed.slice(0, 50),
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

export const structuredDataTool: ToolDefinition = {
  name: "process_data",
  description:
    "Parse and analyze structured data in CSV or JSON format. Supports operations: 'summary' (statistics + schema), 'filter' (filter rows), 'group_by' (group and count), 'read' (view data). Perfect for analyzing datasets, spreadsheets exported to CSV, or JSON API responses.",
  parameters: {
    data: {
      type: "string",
      description: "The CSV or JSON data as a string",
      required: true,
    },
    format: {
      type: "string",
      description: "Data format: 'csv' or 'json'",
      required: true,
    },
    operation: {
      type: "string",
      description: "Operation to perform: 'summary', 'filter', 'group_by', or 'read'",
      required: false,
    },
    filters: {
      type: "object",
      description: 'Filter conditions as key-value pairs (e.g., {"country": "Saudi Arabia", "status": "active"})',
      required: false,
    },
    groupBy: {
      type: "string",
      description: "Column name to group rows by",
      required: false,
    },
    columns: {
      type: "array",
      description: "Specific columns to include in output (empty = all columns)",
      required: false,
      items: { type: "string" },
    },
  },
  execute: async (params) => {
    const filters =
      typeof params.filters === "object" && params.filters !== null
        ? Object.fromEntries(
            Object.entries(params.filters as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        : undefined;

    return processData(
      String(params.data),
      String(params.format),
      String(params.operation ?? "read"),
      filters,
      params.groupBy ? String(params.groupBy) : undefined,
      Array.isArray(params.columns) ? params.columns.map(String) : undefined
    );
  },
};
