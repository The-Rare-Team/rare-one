import Browserbase from "@browserbasehq/sdk";
import { experimental_createMCPClient } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";

interface BroswerSession {
  sessionId: string;
  cdpEndpoint: string;
  liveViewLink: string;
}

export async function startSession(): Promise<BroswerSession> {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID! });

  const liveViewLinks = await bb.sessions.debug(session.id);
  const liveViewLink = liveViewLinks.debuggerFullscreenUrl;

  return { sessionId: session.id, cdpEndpoint: session.connectUrl, liveViewLink };
}

export async function connectPlaywrightMCP(cdpEndpoint: string) {
  const transport = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["@playwright/mcp", "--cdp-endpoint", cdpEndpoint],
  });

  const client = await experimental_createMCPClient({ transport });
  const tools = await client.tools();

  function close() {
    transport.close();
    client.close();
  }

  return { tools, close };
}
