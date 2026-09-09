import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getRepoContext } from "../tools/getRepoContext.js";

export function createServer() {
  const server = new McpServer({
    name: "RepoLensMCP",
    version: "1.0.0",
  });

  server.registerTool(
    "getRepoContext",
    {
      title: "Get Repo Context",
      description:
        "Scans a public GitHub repository and returns a structured markdown summary " +
        "(project purpose, tech stack, folder structure) so an LLM can quickly " +
        "understand the codebase before reading individual files.",
      inputSchema: {
        owner: z.string().describe("GitHub repo owner/organization, e.g. 'Aashwalayan'"),
        repo: z.string().describe("Repo name, e.g. 'RepoLensMCP'"),
        branch: z.string().optional().describe("Branch to scan, defaults to 'main'"),
      },
    },
    async ({ owner, repo, branch }) => {
      const result = await getRepoContext({
        owner,
        repo,
        branch: branch ?? "main" });

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: result.markdown ?? "",
          },
        ],
      };
    }
  );

  return server;
}