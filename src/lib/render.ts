import { relative } from 'path';
import type { RepoGraph } from './types.js';
import { traceChains, findHubSymbols } from './chainTracer.js';
import type { ChainStep } from './chainTracer.js';

function rel(rootDir: string, file: string): string {
  return relative(rootDir, file).replace(/\\/g, '/'); // normalize Windows paths
}

function renderChain(rootDir: string, chain: ChainStep[]): string {
  return chain.map((step) => `${step.symbol || '(module)'} (${rel(rootDir, step.file)})`).join(' → ');
}

export function renderMarkdown(rootDir: string, graph: RepoGraph): string {
  const lines: string[] = [];

  lines.push(`# Repo Map`);
  lines.push('');
  lines.push(`Generated from ${graph.files.length} files, ${graph.edges.length} tracked connections.`);
  lines.push('');

  // --- Entry points ---
  lines.push('## Entry points');
  lines.push('');
  const topEntries = graph.entryPoints.filter((e) => e.score > 0).slice(0, 10);
  if (topEntries.length === 0) {
    lines.push('_No confident entry points detected — consider adding a `.repolens.json` override._');
  } else {
    for (const entry of topEntries) {
      lines.push(`- \`${rel(rootDir, entry.file)}\` (score: ${entry.score}) — ${entry.reasons.join('; ')}`);
    }
  }
  lines.push('');

  // --- Direct connections, grouped by file ---
  lines.push('## Direct connections');
  lines.push('');
  const byFile = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges) {
    const list = byFile.get(edge.fromFile) ?? [];
    list.push(edge);
    byFile.set(edge.fromFile, list);
  }
  for (const [file, edges] of byFile) {
    lines.push(`### \`${rel(rootDir, file)}\``);
    for (const edge of edges) {
      const who = edge.fromSymbol ? `\`${edge.fromSymbol}\`` : 'module top-level';
      lines.push(
        `- ${who} ${edge.usageType}s \`${edge.toSymbol}\` from \`${rel(rootDir, edge.toFile)}\` (line ${edge.line})`
      );
    }
    lines.push('');
  }

  // --- Transitive chains from entry points + hub symbols ---
  lines.push('## Call chains from entry points');
  lines.push('');
  const hubs = findHubSymbols(graph.edges);
  const startingPoints = [
    ...topEntries.slice(0, 5).map((e) => ({ file: e.file, symbol: '' })),
    ...hubs,
  ];

  for (const start of startingPoints) {
    const chains = traceChains(start.file, start.symbol, graph.edges);
    const meaningful = chains.filter((c) => c.length > 1);
    if (meaningful.length === 0) continue;

    lines.push(`### ${start.symbol || '(module)'} — \`${rel(rootDir, start.file)}\``);
    for (const chain of meaningful) {
      lines.push(`- ${renderChain(rootDir, chain)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}