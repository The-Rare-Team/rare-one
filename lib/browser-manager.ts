import Browserbase from "@browserbasehq/sdk";
import { SessionRecording } from "@browserbasehq/sdk/resources/sessions/recording";
import { experimental_createMCPClient } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";

interface BroswerSession {
  sessionId: string;
  cdpEndpoint: string;
  liveViewLink: string;
}

export async function startSession(): Promise<BroswerSession> {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      viewport: { width: 1920, height: 1080 },
    },
  });

  const liveViewLinks = await bb.sessions.debug(session.id);
  const liveViewLink = liveViewLinks.debuggerFullscreenUrl;

  return { sessionId: session.id, cdpEndpoint: session.connectUrl, liveViewLink };
}

export async function getReplay({ sessionId }: { sessionId: string }): Promise<SessionRecording[]> {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const replay = await bb.sessions.recording.retrieve(sessionId);

  return replay;
}

export async function connectPlaywrightMCP(cdpEndpoint?: string | null) {
  const args = ["./node_modules/@playwright/mcp/cli.js"];
  if (cdpEndpoint) {
    args.push("--cdp-endpoint", cdpEndpoint);
  }
  const transport = new Experimental_StdioMCPTransport({
    command: "node",
    args,
  });

  const client = await experimental_createMCPClient({ transport });
  const tools = await client.tools();

  function close() {
    transport.close();
    client.close();
  }

  return { tools, close };
}
