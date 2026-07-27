import type { ArticleSource } from './types';

const SEARCH_TRIGGERS = /\b(today|latest|current|currently|right now|breaking|trending|score|scores|match result|live score|ipl|world cup|election result|stock price|share price|weather|news|happening|update on|what'?s going on)\b/i;

/**
 * Cheap heuristic gate so we only pay for a Tavily call on messages that
 * plausibly need live/current information — mirrors the regex-based
 * approach already used in buildMemoryContext.
 */
export function shouldSearch(userMessage: string): boolean {
  return SEARCH_TRIGGERS.test(userMessage);
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export async function searchWeb(query: string): Promise<ArticleSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: false,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as { results?: TavilyResult[] };
    if (!Array.isArray(data.results)) return [];

    return data.results.slice(0, 3).map((r) => ({
      title: r.title,
      url: r.url,
      source: safeHostname(r.url),
    }));
  } catch (err) {
    console.error('Tavily search error:', err);
    return [];
  }
}

export function buildSearchContext(query: string, sources: ArticleSource[]): string {
  if (sources.length === 0) return '';
  const lines = sources.map((s, i) => `${i + 1}. ${s.title} (${s.url})`).join('\n');
  return `\n\n[LIVE SEARCH RESULTS for "${query}" — use these to ground your answer with current, accurate info. Weave the info in naturally, don't just list the sources.]\n${lines}`;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
