import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { experimental_createMCPClient } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { startBrowserSession } from '@/app/actions';

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json(
      { error: 'URL is required' },
      { status: 400 }
    );
  }
  
  const { tools, client, transport } = await connectTools();

  const { text } = await generateText({
    model: openai('gpt-4.1-mini'),
    tools,
    messages: [
      {
        role: 'user',
        content: `Use playwright tools to go to the page and click on the main Get Started button of the URL: ${url}`
      }
    ],
    maxTokens: 500,
  });

  await client.close();
  await transport.close();

  return NextResponse.json(
    { text },
    { status: 200 }
  );
}

async function connectTools() {
  const { session, liveViewLink } = await startBrowserSession();
  const transport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['@playwright/mcp@latest', '--cdp-endpoint', session.connectUrl],
  });

  const client = await experimental_createMCPClient({
    transport,
  });

  const tools = await client.tools();

  return { tools, client, transport }
}