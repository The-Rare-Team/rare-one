import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json(
      { error: 'URL is required' },
      { status: 400 }
    );
  }

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
    { text },
    { status: 200 }
  );
} 