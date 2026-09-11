import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getRepoContext } from "./tools/getRepoContext.js";

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
        "Returns a structured markdown map of a repo you've previously pushed with " +
        "`repolens push` — includes entry points, file relationships, and call chains " +
        "so an LLM can understand the codebase before reading individual files.",
      inputSchema: {
        repoName: z.string().describe("The repo name as it appears in your pushed repos (matches package.json's 'name' field, or the folder name)"),
      },
    },
    async ({ repoName }) => {
      const result = await getRepoContext({ repoName });

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Error: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: result.markdown ?? "" }],
      };
    }
  );

  return server;
}