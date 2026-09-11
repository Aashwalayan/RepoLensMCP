import { readFileSync, existsSync } from 'fs';
import { basename, join } from 'path';

export interface CliConfig {
  apiKey: string;
  apiUrl: string;
  repoName: string;
  rootDir: string;
}

function detectRepoName(rootDir: string): string {
  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (typeof pkg.name === 'string' && pkg.name.trim()) return pkg.name;
    } catch {
      // fall through to folder name
    }
  }
  return basename(rootDir);
}

export function resolveConfig(rootDir: string = process.cwd()): CliConfig {
  const apiKey = process.env.REPOLENS_KEY;
  if (!apiKey) {
    console.error('Missing REPOLENS_KEY. Set it with:\n  $env:REPOLENS_KEY = "your-key-here"   (PowerShell)\n  export REPOLENS_KEY=your-key-here     (bash/zsh)');
    process.exit(1);
  }

  const apiUrl = process.env.REPOLENS_API_URL || 'http://localhost:3000';

  return {
    apiKey,
    apiUrl,
    repoName: detectRepoName(rootDir),
    rootDir,
  };
}