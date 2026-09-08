import fs from "node:fs";
import path from "node:path";

/**
 * Pulls the first meaningful paragraph out of README.md to use as a
 * plain-English project summary. No LLM call in v1 — just takes the
 * first non-heading, non-empty paragraph after the title.
 */
export function extractReadmeSummary(rootDir: string): string | null {
  const candidates = ["README.md", "readme.md", "Readme.md"];
  let readmePath: string | null = null;

  for (const name of candidates) {
    const fullPath = path.join(rootDir, name);
    if (fs.existsSync(fullPath)) {
      readmePath = fullPath;
      break;
    }
  }

  if (!readmePath) return null;

  const content = fs.readFileSync(readmePath, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 20 &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("![") &&
      !trimmed.startsWith("[![") &&
      !trimmed.startsWith("<")
    ) {
      return trimmed;
    }
  }

  return null;
}