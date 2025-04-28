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
  await toolTest();

  const { text } = await generateText({
    model: openai('gpt-4.1-mini'),
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that analyzes URLs and provides concise descriptions of their content.'
      },
      {
        role: 'user',
        content: `Please analyze this URL and provide a brief description of what it contains: ${url}`
      }
    ],
    maxTokens: 500,
  });

  return NextResponse.json(
    { text: 'test' },
    { status: 200 }
  );
}

async function toolTest() {
  const { session, liveViewLink } = await startBrowserSession();
  const transport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['@playwright/mcp@latest', '--cdp-endpoint', session.connectUrl],
  });

  const client = await experimental_createMCPClient({
    transport,
  });

  const tools = await client.tools();
  // console.log(tools);
  
  const result = await tools.browser_navigate.execute({
    url: 'https://www.google.com',
  }, {
    toolCallId: '1',
    messages: [
      {
        role: 'user',
        content: 'Please analyze this URL and provide a brief description of what it contains: https://www.google.com'
      }
    ]
  });
  console.log(result);

  await client.close();
  await transport.close();
}