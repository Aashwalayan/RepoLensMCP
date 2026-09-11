import { Project } from 'ts-morph';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { buildGraph } from './graphBuilder.js';
import { detectEntryPoints } from './entryPoints.js';
import { renderMarkdown } from './render.js';
import type { RepoGraph } from './types.js';

export interface GenerateOptions {
  rootDir: string;                 // project root to analyze
  tsConfigFilePath?: string;       // defaults to <rootDir>/tsconfig.json if present
  include?: string[];              // glob(s), defaults to all ts/tsx
  outFile?: string;                // if provided, writes markdown here too
}

export function generateRepoMap(options: GenerateOptions): string {
  const { rootDir, include = ['**/*.{ts,tsx}'], outFile } = options;

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    ...(options.tsConfigFilePath ? { tsConfigFilePath: options.tsConfigFilePath } : {}),
    });

  for (const pattern of include) {
    project.addSourceFilesAtPaths(join(rootDir, pattern));
  }

  const { files, edges } = buildGraph(project);
  const entryPoints = detectEntryPoints(project, rootDir, files, edges);

  const graph: RepoGraph = { files, edges, entryPoints };
  const markdown = renderMarkdown(rootDir, graph);

  if (outFile) {
    writeFileSync(outFile, markdown, 'utf-8');
  }

  return markdown;
}

// --- Example direct usage (e.g. from your CLI's `push`/`watch` command) ---
//
// import { generateRepoMap } from './index.js';
//
// const markdown = generateRepoMap({
//   rootDir: process.cwd(),
//   outFile: join(process.cwd(), 'repo-context.md'),
// });
//
// await fetch('https://yourservice.com/api/push', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ markdown }),
// });