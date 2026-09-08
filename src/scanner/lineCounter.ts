import fs from "node:fs";
import path from "node:path";
import { isIgnoredDir, isIgnoredFile } from "../utils/ignorePatterns.js";

export interface LineCountResult {
  totalLines: number;
  totalFiles: number;
  byExtension: Record<string, number>;
}

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".c", ".cpp", ".h", ".cs", ".swift", ".kt",
  ".md", ".json", ".yaml", ".yml", ".html", ".css", ".scss",
]);

/**
 * Walks the repo and counts non-blank lines across recognized text/code files.
 * This runs BEFORE any expensive analysis so we can cheaply check the
 * free-tier threshold first.
 */
export function countLines(rootDir: string): LineCountResult {
  let totalLines = 0;
  let totalFiles = 0;
  const byExtension: Record<string, number> = {};

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isIgnoredDir(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }

      if (isIgnoredFile(entry.name)) continue;

      const ext = path.extname(entry.name);
      if (!TEXT_EXTENSIONS.has(ext)) continue;

      const fullPath = path.join(dir, entry.name);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim().length > 0);

      totalLines += lines.length;
      totalFiles += 1;
      byExtension[ext] = (byExtension[ext] ?? 0) + lines.length;
    }
  }

  walk(rootDir);

  return { totalLines, totalFiles, byExtension };
}