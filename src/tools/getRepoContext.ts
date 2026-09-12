export interface GetRepoContextInput {
  repoName: string;
}

export interface GetRepoContextResult {
  success: boolean;
  markdown?: string;
  error?: string;
}

const API_URL = process.env.REPOLENS_API_URL || 'https://repolensmcp-production.up.railway.app';
const API_KEY = process.env.REPOLENS_KEY;

/**
 * The MCP tool's core logic. Fetches the ALREADY-GENERATED repo map from the
 * backend (pushed there earlier by `repolens push`/`watch`) — this tool does
 * NOT clone or analyze anything itself anymore.
 */
export async function getRepoContext(input: GetRepoContextInput): Promise<GetRepoContextResult> {
  if (!API_KEY) {
    return {
      success: false,
      error: 'REPOLENS_KEY is not set. Configure it in your MCP server environment.',
    };
  }

  try {
    const res = await fetch(`${API_URL}/api/context/${encodeURIComponent(input.repoName)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { success: false, error: body.error ?? `Request failed with status ${res.status}` };
    }

    const body = (await res.json()) as { markdown: string };
    return { success: true, markdown: body.markdown };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching repo context',
    };
  }
}