import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { experimental_createMCPClient } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
import { z } from "zod";
import { startBrowserSession } from "@/app/actions";

// Define the schema for the expected structured output
const urlSchema = z.object({
  journey: z.array(z.object({
    action: z.enum(["navigate", "click", "type", "selectOption", "press"]),
    selector: z.string().optional(),
    url: z.string().optional(),
    text: z.string().optional(),
    values: z.array(z.string()).optional(),
    key: z.string().optional(),
  })).describe('The sequence of actions taken.'),
  finalUrl: z.string().url().describe('The final URL after all actions are completed.'),
});

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const { tools, client, transport } = await connectTools();


  const systemPrompt = `
  You are a senior QA engineer and Playwright MCP specialist. Your job is to drive an autonomous "expert tester" that uses only the Playwright MCP tools provided. At each step:
  1. Snapshot the page and enumerate all interactive elements (links, buttons, form fields, dropdowns, etc.) visible in the current view.
  2. Choose the highest-priority actions that moves the user toward completion of the primary goal. This includes filling required fields, selecting options, clicking 'Next'/'Continue' buttons in sequence, and **critically, identifying and clicking the final 'Submit', 'Complete', 'Finish', 'Confirm', or similar button once all required information appears to be entered.**
  3. **After clicking a 'Next' or 'Submit' button, carefully re-analyze the page snapshot. Ensure the form has advanced to the *next* logical step (look for new, different field labels or section titles) before selecting the next action. Do NOT interact with fields (e.g., 'First name', 'Last name') that you have already successfully completed in a previous step of this specific form journey.**
  4. **If no immediate actions are obvious (especially if you just clicked 'Next'), carefully analyze the *entire current snapshot* again. If necessary and supported by the available tools, consider using a keyboard press action (like 'PageDown') to potentially reveal more content before deciding to stop. Do NOT invent or call a dedicated 'scroll' tool.**
  5. **Remember: The goal is not just to fill fields, but to successfully submit the entire form or complete the defined task.** Execute the chosen action(s) via the appropriate *available* MCP tool.
  6. Record each action in order, using only the allowed action types: navigate, click, type, selectOption, press.
  7. Repeat until the task is confirmed complete (e.g., seeing 'Thank You', 'Success', 'Complete' text) OR **after thoroughly analyzing the snapshot (and potentially attempting a key press like PageDown), absolutely no further interactive fields OR final submission buttons (like 'Submit', 'Complete', 'Confirm', button[type='submit']) can be found.**
  8. At the end, output **only** this JSON object (no extra text):
     {
       "journey": [
         { "action": "navigate",    "url": "..."              },
         { "action": "click",       "selector": "#buy-now"    },
         { "action": "type",        "selector": "input#email","text": "foo@bar.com" },
         { "action": "selectOption","selector":"select#qty",   "values": [ "2" ]    },
         { "action": "press",       "key": "PageDown"         }, // Example using press for PageDown
         { "action": "click",       "selector": "button#submit"}  // Example including submit
         // …etc…
       ],
       "finalUrl": "<the URL you end up on>"
     }
  `.trim();

  // You might also refine the user prompt slightly if needed, but the system prompt usually has more impact on the agent's behavior.
  const userPrompt = `
  Given URL: ${url}

  1. Navigate to this URL using the 'browser_navigate' tool.
  2. Loop using the available tools (browser_snapshot, browser_click, browser_type, browser_select_option, browser_press_key, etc.):
     a. Take a snapshot.
     b. Identify the most impactful next action on the page based *only* on the available tools (click, type, select, submit, or press 'PageDown' if needed and available).
     c. Perform it and wait for any navigation or DOM update.
     d. Record the step using only the allowed actions in the schema: navigate, click, type, selectOption, press.
     e. Stop **only** when the task is fully complete (e.g., form submitted, confirmation page reached) or no further actions are possible after analyzing the snapshot (and potentially using 'press KeyDown').

  Finally, emit exactly the JSON schema defined above under "journey" and "finalUrl." Do not include any action types other than navigate, click, type, selectOption, or press.
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
    maxSteps: 25,
    experimental_output: Output.object({ schema: urlSchema })
  });

  let text, steps, toolCalls, toolResults, output;
  try {
    ({ text, steps, toolCalls, toolResults, experimental_output: output } = await generateText({
      model: openai('gpt-4.1-nano'), // 'gpt-4o'
      system: systemPrompt,
      tools,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.1,
      maxTokens: 1000,
      maxSteps: 25,
      experimental_output: Output.object({ schema: urlSchema })
    }));
  } catch (error: any) {
    console.error("Error during generateText:", error);
    await client.close(); // Ensure cleanup even on error
    await transport.close();
    // Check if it's an AI SDK specific error we know how to handle
    if (error.toolName && error.availableTools) {
      return NextResponse.json(
        { 
          error: `AI model tried to use unavailable tool '${error.toolName}'. Available tools: ${error.availableTools.join(', ')}`,
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    // Generic error
    return NextResponse.json(
      { 
        error: "Failed to analyze URL due to an internal error.",
        details: error.message || "Unknown error" 
      }, 
      { status: 500 }
    );
  }
  
  console.log('=== raw toolCalls ===', toolCalls);
  console.log('=== raw toolResults ===', toolResults);
  steps.forEach((step, i) => {
    console.log(`\n--- STEP ${i + 1} (${step.stepType}) ---`);
    console.log('finishReason:', step.finishReason);
    console.log('toolCalls:', step.toolCalls);
    console.log('toolResults:', step.toolResults);
  });



  // Log the raw output for debugging
  console.log("generateText returned (raw):", JSON.stringify({ text, toolCalls, toolResults, output }, null, 2));

  await client.close();
  await transport.close();
  // Ensure output exists and has the finalUrl property
  const finalUrl = output?.finalUrl; 
  const journey = output?.journey; // You might want to use the journey data too

  const formattedOutput = finalUrl 
    ? `@${finalUrl}` 
    : 'Error: Could not extract final URL';
  
  // Optionally include journey in the response if needed
  return NextResponse.json(
    { 
      text: formattedOutput, 
      // journey: journey // Uncomment if you want to return the journey too
    }, 
    { status: 200 }
  );
}

async function connectTools() {
  const { session, liveViewLink } = await startBrowserSession();
  const transport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['@playwright/mcp@latest', '--cdp-endpoint', session.connectUrl], // , '--vision'
  });

  const client = await experimental_createMCPClient({
    transport,
  });

  const tools = await client.tools();

  return { tools, client, transport };
}
