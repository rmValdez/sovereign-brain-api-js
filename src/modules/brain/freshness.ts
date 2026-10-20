export const FRESHNESS_KEYWORDS = [
  "latest",
  "today",
  "yesterday",
  "tomorrow",
  "current",
  "currently",
  "recent",
  "recently",
  "this week",
  "this month",
  "breaking",
  "news",
  "what happened",
  "what's happening",
  "as of now",
  "just announced",
  "newest",
  "up to date",
  "up-to-date",
  "right now",
];

export const FRESHNESS_SATISFYING_TOOLS = new Set(["web_search", "current_time"]);

export function requiresFreshData(text: string): boolean {
  const lower = text.toLowerCase();
  return FRESHNESS_KEYWORDS.some((kw) => lower.includes(kw));
}

export function freshnessSatisfied(toolsUsed: string[]): boolean {
  return toolsUsed.some((tool) => FRESHNESS_SATISFYING_TOOLS.has(tool));
}

export const CONTINUATION_PHRASES = [
  "search again",
  "look again",
  "check again",
  "try that again",
  "do that again",
  "search that again",
];

export function isSearchContinuation(text: string): boolean {
  const lower = text.toLowerCase();
  return CONTINUATION_PHRASES.some((p) => lower.includes(p));
}
