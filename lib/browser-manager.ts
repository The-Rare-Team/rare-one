import Browserbase from "@browserbasehq/sdk";
import { experimental_createMCPClient } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";

interface BroswerSession {
  browserbaseSessionId: string;
  cdpEndpoint: string;
  liveViewLink: string;
  mcpTransport?: { close: () => Promise<void> };
  mcpClient?: { close: () => Promise<void> };
}

async function _startBrowserbaseSession(): Promise<BroswerSession> {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID! });

  const liveViewLinks = await bb.sessions.debug(session.id);
  const liveViewLink = liveViewLinks.debuggerFullscreenUrl;

  return { browserbaseSessionId: session.id, cdpEndpoint: session.connectUrl, liveViewLink };
}

export async function startSession() {
  const session = await _startBrowserbaseSession();
  const transport = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["@playwright/mcp@latest", "--cdp-endpoint", session.cdpEndpoint],
  });

  const client = await experimental_createMCPClient({ transport });
  const tools = await client.tools();
  session.mcpTransport = transport;
  session.mcpClient = client;

  return { session, tools };
}

export async function endSession(session: BroswerSession) {
  await session.mcpTransport?.close();
  await session.mcpClient?.close();
}
