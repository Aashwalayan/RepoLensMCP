import { Project, SyntaxKind } from 'ts-morph';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import  type { Edge, ScoredEntryPoint } from './types.js';

function findUnimportedFiles(files: string[], edges: Edge[]): string[] {
  const imported = new Set(edges.map((e) => e.toFile));
  return files.filter((f) => !imported.has(f));
}

function getConventionalEntryPoints(rootDir: string): string[] {
  const pkgPath = join(rootDir, 'package.json');
  if (!existsSync(pkgPath)) return [];

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const entries: string[] = [];

  if (typeof pkg.main === 'string') entries.push(pkg.main);
  if (pkg.bin) {
    const bins = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin);
    entries.push(...(bins as string[]));
  }
  if (pkg.exports && typeof pkg.exports === 'object') {
    for (const v of Object.values(pkg.exports)) {
      if (typeof v === 'string') entries.push(v);
    }
  }

  // Normalize to absolute-ish paths matching what ts-morph reports
  return entries.map((e) => join(rootDir, e.replace(/^\.\//, '')));
}

function hasTopLevelSideEffect(file: ReturnType<Project['getSourceFiles']>[number]): boolean {
  const SIDE_EFFECT_PATTERN = /\.(listen|connect|start)\s*\(/;
  return file.getStatements().some((stmt) => {
    if (stmt.getKind() !== SyntaxKind.ExpressionStatement) return false;
    return SIDE_EFFECT_PATTERN.test(stmt.getText());
  });
}

function loadManualOverrides(rootDir: string): string[] {
  const configPath = join(rootDir, '.repolens.json');
  if (!existsSync(configPath)) return [];
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return (config.entryPoints ?? []).map((p: string) => join(rootDir, p));
  } catch {
    return [];
  }
}

export function detectEntryPoints(
  project: Project,
  rootDir: string,
  files: string[],
  edges: Edge[]
): ScoredEntryPoint[] {
  const unimported = findUnimportedFiles(files, edges);
  const conventional = new Set(getConventionalEntryPoints(rootDir));
  const sideEffecting = new Set(
  project.getSourceFiles().filter(hasTopLevelSideEffect).map((f) => f.getFilePath().toString())
);
  const manual = new Set(loadManualOverrides(rootDir));

  const candidates = new Set([...unimported, ...manual]);

  const scored: ScoredEntryPoint[] = [...candidates].map((file) => {
    const reasons: string[] = [];
    let score = 0;

    if (unimported.includes(file)) {
      score += 1;
      reasons.push('not imported by any other file');
    }
    if (conventional.has(file)) {
      score += 2;
      reasons.push('listed in package.json (main/bin/exports)');
    }
    if (sideEffecting.has(file)) {
      score += 2;
      reasons.push('has a top-level side effect (e.g. .listen/.start)');
    }
    if (manual.has(file)) {
      score += 3;
      reasons.push('manually specified in .repolens.json');
    }

    return { file, score, reasons };
  });

  return scored.sort((a, b) => b.score - a.score);
}