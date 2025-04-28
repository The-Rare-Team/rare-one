import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { experimental_createMCPClient } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
import { z } from "zod";
import { startBrowserSession } from "@/app/actions";

// Define the schema for the expected structured output
const urlSchema = z.object({
  finalUrl: z.string().url().describe("The final URL after all actions are completed."),
});

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const { tools, client, transport } = await connectTools();

  // System prompt emphasizing structured output
  // const systemPrompt = `You are an expert web browsing assistant. Your goal is to fulfill the user's request by navigating a web page and interacting with elements using the available Playwright tools. After completing all actions, you MUST provide the final page URL in the specified structured object format. Do not include any conversational text in the final output object.`;
  const systemPrompt = `
  You are a senior QA engineer and Playwright MCP specialist. Your responsibilities:
  1. Use **only** the Playwright MCP tools to navigate and interact.
  2. Automatically identify and execute the **primary user journey**—i.e. the most prominent call-to-action or conversion path on the page.
  3. After every action, track it in an ordered list.
  4. At the end, output **only** a JSON object (no extra text) with:
     • **journey**: array of steps, each { action, selector?, url? }  
     • **finalUrl**: the URL you end on  
  If you encounter multiple candidate CTAs, pick the one with the largest visible area or highest semantic prominence.
  `.trim();

  // User request defining the specific journey and requesting structured output
  // const userPrompt = `Use playwright MCP tools to go to the page and click on the main user journey link/button: ${url}. After completing the actions, return the final page URL using the provided structured output schema.`;

  const userPrompt = `
  Given URL: ${url}
  
  Steps:
  1. Navigate to this URL.
  2. Identify the main user-journey element (largest/highest-contrast button or link).
  3. Click or interact with it and wait for any navigation.
  4. Repeat if the “primary journey” spans multiple clicks.
  
  Finally, return a JSON object matching this schema exactly:
  
  {
    "journey": [
      { "action": "navigate", "url": "<initial URL>" },
      { "action": "click",    "selector": "<CSS selector>" }
      // …additional steps if any…
    ],
    "finalUrl": "<resulting URL>"
  }
  `.trim();

  console.log("Calling generateText with:", {
    model: "gpt-4.1-mini",
    tools: !!tools,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0,
    maxTokens: 5000,
    maxSteps: 10,
    experimental_output: { schema: urlSchema }, // Log structured output schema presence
  });

  const {
    text,
    toolCalls,
    toolResults,
    experimental_output: output,
  } = await generateText({
    model: openai("gpt-4.1-mini"),
    system: systemPrompt,
    tools,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.2,
    maxTokens: 5000,
    maxSteps: 10,
    experimental_output: Output.object({ schema: urlSchema }), // Use structured output
  });

  // Log the raw output for debugging
  console.log(
    "generateText returned (raw):",
    JSON.stringify({ text, toolCalls, toolResults, output }, null, 2),
  );

  await client.close();
  await transport.close();

  // Extract and format the final URL from the structured output
  const finalUrl = output?.finalUrl;
  const formattedOutput = finalUrl ? `@${finalUrl}` : "Error: Could not extract final URL";

  return NextResponse.json(
    { text: formattedOutput }, // Return the formatted URL only
    { status: 200 },
  );
}

async function connectTools() {
  const { session, liveViewLink } = await startBrowserSession();
  const transport = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["@playwright/mcp@latest", "--cdp-endpoint", session.connectUrl],
  });

  const client = await experimental_createMCPClient({
    transport,
  });

  const tools = await client.tools();

  return { tools, client, transport };
}
