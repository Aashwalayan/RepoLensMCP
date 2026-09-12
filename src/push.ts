import { existsSync } from 'fs';
import { join } from 'path';
import { generateRepoMap } from './lib/index.js';
import type { CliConfig } from './cliConfig.js';

export interface PushOutcome {
  ok: boolean;
  downloadUrl?: string;
  error?: string;
}

interface PushResponse {
  error?: string;
  downloadUrl?: string;
}

export async function pushOnce(config: CliConfig): Promise<PushOutcome> {
  const tsConfigPath = join(config.rootDir, 'tsconfig.json');

  const markdown = generateRepoMap({
    rootDir: config.rootDir,
    ...(existsSync(tsConfigPath) ? { tsConfigFilePath: tsConfigPath } : {}),
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

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as PushResponse;
      return { ok: false, error: `${res.status} ${res.statusText}: ${body.error ?? 'unknown error'}` };
    }

    const body = (await res.json()) as PushResponse;
    return { ok: true, downloadUrl: `${config.apiUrl}${body.downloadUrl}` };
  } catch (err) {
    const cause = err instanceof Error && 'cause' in err ? err.cause : undefined;
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[repolens push] Raw fetch error:', err);
    if (cause) console.error('[repolens push] Cause:', cause);
    return { ok: false, error: cause ? `${detail} (${String(cause)})` : detail };
  }
}