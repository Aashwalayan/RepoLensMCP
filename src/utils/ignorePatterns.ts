// Folders and files that add noise, not signal, to repo context.
// Skip these entirely during scanning and line counting.

export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist_test",
  "build",
  ".next",
  ".turbo",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
]);

export const IGNORED_FILE_PATTERNS: RegExp[] = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.js$/,
  /\.map$/,
  /\.lock$/,
];

export function isIgnoredDir(dirName: string): boolean {
  return IGNORED_DIRS.has(dirName);
}

export function isIgnoredFile(fileName: string): boolean {
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}