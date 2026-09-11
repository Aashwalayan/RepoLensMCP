import type { Edge } from './types.js';

export interface ChainStep {
  file: string;
  symbol: string;
}

const MAX_DEPTH = 6;

/**
 * Returns every root-to-leaf path starting from `startFile`/`startSymbol`,
 * following edges where fromFile+fromSymbol matches the current step.
 * Cross-file edges only by default (see `crossFileOnly`).
 */
export function traceChains(
  startFile: string,
  startSymbol: string,
  edges: Edge[],
  crossFileOnly = true
): ChainStep[][] {
  function walk(
    file: string,
    symbol: string,
    visited: Set<string>,
    depth: number
  ): ChainStep[][] {
    const key = `${file}#${symbol}`;
    if (visited.has(key) || depth > MAX_DEPTH) {
      return [[{ file, symbol: `${symbol} (stopped: cycle or depth limit)` }]];
    }

    const nextVisited = new Set(visited);
    nextVisited.add(key);

    let outgoing = edges.filter((e) => e.fromFile === file && e.fromSymbol === symbol);
    if (crossFileOnly) {
      outgoing = outgoing.filter((e) => e.toFile !== file);
    }

    if (outgoing.length === 0) {
      return [[{ file, symbol }]];
    }

    const results: ChainStep[][] = [];
    for (const edge of outgoing) {
      const subChains = walk(edge.toFile, edge.toSymbol, nextVisited, depth + 1);
      for (const sub of subChains) {
        results.push([{ file, symbol }, ...sub]);
      }
    }
    return results;
  }

  return walk(startFile, startSymbol, new Set(), 0);
}

/**
 * Symbols called from 3+ distinct locations — worth expanding even if
 * they aren't entry points, since they're structurally significant "hubs".
 */
export function findHubSymbols(edges: Edge[], minCallers = 3): { file: string; symbol: string }[] {
  const counts = new Map<string, { file: string; symbol: string; count: number }>();

  for (const edge of edges) {
    const key = `${edge.toFile}#${edge.toSymbol}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { file: edge.toFile, symbol: edge.toSymbol, count: 1 });
    }
  }

  return [...counts.values()].filter((c) => c.count >= minCallers).map(({ file, symbol }) => ({ file, symbol }));
}