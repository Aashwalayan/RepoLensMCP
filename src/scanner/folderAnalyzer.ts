import fs from "node:fs";
import path from "node:path";
import { isIgnoredDir } from "../utils/ignorePatterns.js";

export interface FolderNode {
  name: string;
  path: string;
  purpose?: string;
  children: FolderNode[];
  fileCount: number;
}

// Common folder names mapped to a plain-English guess at their purpose.
// This is intentionally simple pattern-matching for v1 (no LLM call).
const KNOWN_FOLDER_PURPOSES: Record<string, string> = {
  src: "Main source code",
  lib: "Shared library code",
  components: "UI components",
  pages: "Page-level routes/views",
  routes: "API or app routes",
  api: "API endpoint handlers",
  utils: "Shared utility functions",
  helpers: "Shared helper functions",
  hooks: "Reusable logic (e.g. React hooks)",
  services: "Business logic / external service calls",
  models: "Data models / schema definitions",
  controllers: "Request handlers (MVC pattern)",
  middleware: "Request/response middleware",
  config: "Configuration files",
  tests: "Test files",
  test: "Test files",
  __tests__: "Test files",
  scripts: "Standalone scripts / tooling",
  public: "Static assets served as-is",
  assets: "Static assets (images, fonts, etc.)",
  styles: "Stylesheets",
  docs: "Documentation",
  types: "Shared TypeScript type definitions",
  migrations: "Database migrations",
};

export function analyzeFolderStructure(rootDir: string, maxDepth = 4): FolderNode {
  function walk(dir: string, depth: number): FolderNode {
    const name = path.basename(dir);
    const entries = depth < maxDepth
      ? fs.readdirSync(dir, { withFileTypes: true })
      : [];

    const children: FolderNode[] = [];
    let fileCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isIgnoredDir(entry.name)) continue;
        children.push(walk(path.join(dir, entry.name), depth + 1));
      } else {
        fileCount += 1;
      }
    }

    return {
      name,
      path: dir,
      purpose: KNOWN_FOLDER_PURPOSES[name.toLowerCase()],
      children,
      fileCount,
    };
  }

  return walk(rootDir, 0);
}