import { fetchRepoToTemp, cleanupTemp } from "../scanner/cloneOrFetch.js";
import { countLines } from "../scanner/lineCounter.js";
import { analyzeFolderStructure } from "../scanner/folderAnalyzer.js";
import { parsePackageJson } from "../scanner/packageParser.js";
import { extractReadmeSummary } from "../scanner/readmeExtractor.js";
import { buildContextMarkdown } from "../generator/buildContextMd.js";
import { checkThreshold } from "../limits/threshold.js";

export interface GetRepoContextInput {
  owner: string;
  repo: string;
  branch?: string;
  githubToken?: string; // for private repos, paid tier
  isPaidUser?: boolean;
}

export interface GetRepoContextResult {
  success: boolean;
  markdown?: string;
  error?: string;
  totalLines?: number;
}

/**
 * The core MCP tool logic. Fetches the repo, checks the free-tier threshold
 * BEFORE doing expensive analysis, then generates the context markdown.
 */
export async function getRepoContext(
  input: GetRepoContextInput
): Promise<GetRepoContextResult> {
  const { owner, repo, branch = "main", githubToken, isPaidUser = false } = input;

  let tempDir: string | null = null;

  try {
    tempDir = await fetchRepoToTemp(owner, repo, branch, githubToken);

    // Cheap check first — bail before running the full analysis if over the limit
    const lineStats = countLines(tempDir);
    const threshold = checkThreshold(lineStats.totalLines, isPaidUser);

    if (!threshold.allowed) {
      return {
        success: false,
        error: threshold.message,
        totalLines: threshold.totalLines,
      };
    }

    const folderTree = analyzeFolderStructure(tempDir);
    const packageInfo = parsePackageJson(tempDir);
    const readmeSummary = extractReadmeSummary(tempDir);

    const markdown = buildContextMarkdown({
      repoName: `${owner}/${repo}`,
      readmeSummary,
      packageInfo,
      folderTree,
      lineStats,
    });

    return { success: true, markdown, totalLines: lineStats.totalLines };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error scanning repo",
    };
  } finally {
    if (tempDir) cleanupTemp(tempDir);
  }
}