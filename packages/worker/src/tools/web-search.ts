import { webSearchToolDef } from "@workspace/shared/tools";
import { ToolDefinition } from "./types.js";

interface SerpApiOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

export const webSearchTool = new ToolDefinition(
  webSearchToolDef.name,
  webSearchToolDef.description,
  webSearchToolDef.inputSchema,
  async (input): Promise<string> => {
    const apiKey = process.env["SERP_API_KEY"];
    if (!apiKey) {
      return "Error: SERP_API_KEY environment variable is not set.";
    }

    const numResults = input.num_results ?? 5;

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q", input.query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("engine", "google");
    url.searchParams.set("num", String(numResults));
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "User-Agent": "a-very-cool-agent/0.1.0" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        return `Error: SerpAPI returned HTTP ${res.status} ${res.statusText}`;
      }

      const data = (await res.json()) as SerpApiResponse;

      if (data.error) {
        return `Error: ${data.error}`;
      }

      const results = data.organic_results ?? [];

      if (results.length === 0) {
        return "No results found for the given query.";
      }

      const MAX_SNIPPET_CHARS = 500;
      return results
        .slice(0, numResults)
        .map((r, i) => {
          const title = r.title ?? "(no title)";
          const link = r.link ?? "(no URL)";
          const rawSnippet = r.snippet ?? "(no snippet)";
          const snippet =
            rawSnippet.length > MAX_SNIPPET_CHARS
              ? rawSnippet.slice(0, MAX_SNIPPET_CHARS) + "…"
              : rawSnippet;
          return `[${i + 1}] ${title}\nURL: ${link}\n${snippet}`;
        })
        .join("\n\n");
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
