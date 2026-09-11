import { generateRepoMap } from './lib/index.js';
import type { CliConfig } from './cliConfig.js';

export interface PushOutcome {
  ok: boolean;
  downloadUrl?: string;
  error?: string;
}

export async function pushOnce(config: CliConfig): Promise<PushOutcome> {
  const markdown = generateRepoMap({
    rootDir: config.rootDir,
    tsConfigFilePath: `${config.rootDir}/tsconfig.json`,
  });

  const fileCount = (markdown.match(/^### `/gm) ?? []).length; // rough count from render.ts's output shape

  try {
    const res = await fetch(`${config.apiUrl}/api/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        repoName: config.repoName,
        markdown,
        fileCount,
      }),
    });

    interface PushResponse {
      error?: string;
      downloadUrl?: string;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as PushResponse;
      return { ok: false, error: `${res.status} ${res.statusText}: ${body.error ?? 'unknown error'}` };
    }

    const body = (await res.json()) as PushResponse;
    return { ok: true, downloadUrl: `${config.apiUrl}${body.downloadUrl}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}