import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RepoLensMCP running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting RepoLensMCP:", err);
  process.exit(1);
});