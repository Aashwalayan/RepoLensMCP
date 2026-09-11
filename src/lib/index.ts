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

  // Strip anything that got swept in from node_modules — addSourceFilesAtPaths
  // globs the filesystem directly and doesn't respect .gitignore or tsconfig excludes.
  for (const file of project.getSourceFiles()) {
    const path = file.getFilePath();
    if (path.includes('node_modules') || path.includes('/dist/') || path.includes('\\dist\\')) {
      project.removeSourceFile(file);
    }
  }

  console.log(`[repolens] scanning ${project.getSourceFiles().length} files after exclusions`);

  const { files, edges } = buildGraph(project);
  const entryPoints = detectEntryPoints(project, rootDir, files, edges);

  const graph: RepoGraph = { files, edges, entryPoints };
  const markdown = renderMarkdown(rootDir, graph);

  console.log(`[repolens] generated markdown: ${markdown.length} chars, ${files.length} files, ${edges.length} edges`);

  if (outFile) {
    writeFileSync(outFile, markdown, 'utf-8');
  }

  return markdown;
}