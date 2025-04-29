import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Test } from "./generated/prisma/client";
import { connectPlaywrightMCP } from "@/lib/browser-manager";

// Define the schema for the expected structured output
const urlSchema = z.object({
  siteDescription: z.string().describe("A brief description of the site extracted from the landing page."),
  journey: z
    .array(
      z.object({
        action: z.enum(["navigate", "click", "type", "selectOption", "press"]),
        selector: z.string().optional(),
        url: z.string().optional(),
        text: z.string().optional(),
        values: z.array(z.string()).optional(),
        key: z.string().optional(),
      }),
    )
    .describe("The sequence of actions taken."),
  stepsSummary: z
    .array(z.string())
    .describe("A list of steps taken during the test, with each item representing a distinct step."),
  finalUrl: z.string().url().describe("The final URL after all actions are completed."),
});

export async function runAIAgent(test: Test) {
  const url = test.url;
  const { tools, close } = await connectPlaywrightMCP(test.cdpEndpoint!);

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
       "siteDescription": "A concise description of the website based on the landing page, including its purpose and main features",
       "journey": [
         { "action": "navigate",    "url": "..."              },
         { "action": "click",       "selector": "#buy-now"    },
         { "action": "type",        "selector": "input#email","text": "foo@bar.com" },
         { "action": "selectOption","selector":"select#qty",   "values": [ "2" ]    },
         { "action": "press",       "key": "PageDown"         }, // Example using press for PageDown
         { "action": "click",       "selector": "button#submit"}  // Example including submit
         // …etc…
       ],
       "stepsSummary": [
         "Step 1: Navigated to the landing page",
         "Step 2: Clicked the buy now button",
         "Step 3: Entered email address",
         "Step 4: Selected quantity of 2",
         "Step 5: Pressed PageDown to reveal more content",
         "Step 6: Clicked the submit button to complete the purchase"
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

  3. After your first navigation to the URL, extract a concise description of the site - what it appears to be about based on visible text, headings, images, etc.
  4. Track all steps taken and create a list of steps, with each entry describing a distinct action taken during the test. Number each step (e.g., "Step 1: Navigated to the landing page").

  Finally, emit exactly the JSON schema defined above including "siteDescription", "journey", "stepsSummary" and "finalUrl." Do not include any action types other than navigate, click, type, selectOption, or press.
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
    experimental_output: Output.object({ schema: urlSchema }),
  });

  let text, steps, toolCalls, toolResults, output, reasoning, sources, finishReason, usage;
  try {
    ({
      text,
      steps,
      toolCalls,
      toolResults,
      experimental_output: output,
      reasoning,
      sources,
      finishReason,
      usage,
    } = await generateText({
      model: openai("gpt-4.1-mini"), // 'gpt-4o', 'gpt-4.1-nano' ,  'o1-mini-2024-09-12'
      system: systemPrompt,
      tools,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.1,
      maxTokens: 5000,
      maxSteps: 25,
      experimental_output: Output.object({ schema: urlSchema }),
    }));

    // Log additional information from generateText results
    console.log("=== Model Reasoning ===");
    console.log(reasoning || "No reasoning provided");

    console.log("=== Finish Reason ===");
    console.log(finishReason || "No finish reason provided");

    console.log("=== Sources ===");
    console.log(sources?.length ? sources : "No sources provided");

    console.log("=== Usage Statistics ===");
    console.log(usage || "No usage statistics provided");
  } finally {
    close();
  }

  steps.forEach((step, i) => {
    console.log(`\n--- STEP ${i + 1} (${step.stepType}) ---`);
    console.log("THE step:", step);
    console.log("finishReason:", step.finishReason);
    console.log("toolCalls:", step.toolCalls);
    console.log("toolResults:", step.toolResults);
  });

  // Log the raw output for debugging
  console.log("generateText returned (raw):", JSON.stringify({ text, toolCalls, toolResults, output }, null, 2));

  // Log the new fields
  console.log("=== Site Description ===");
  console.log(output?.siteDescription || "No site description provided");

  console.log("=== Steps Summary ===");
  console.log(output?.stepsSummary || "No steps summary provided");

  // Ensure output exists and has the finalUrl property
  const finalUrl = output?.finalUrl;
  const journey = output?.journey; // You might want to use the journey data too
  const siteDescription = output?.siteDescription;
  const stepsSummary = output?.stepsSummary;

  // Return all the required data instead of just the formatted URL
  const returnObject = {
    finalUrl: finalUrl || null,
    siteDescription: siteDescription || null,
    stepsSummary: stepsSummary || null,
    journey: journey || [],
  };

  console.log("=== Return Object ===");
  console.log(JSON.stringify(returnObject, null, 2));

  return returnObject;
}
