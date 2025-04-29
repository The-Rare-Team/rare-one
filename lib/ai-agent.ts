import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Test } from "./generated/prisma/client";
import { connectPlaywrightMCP } from "@/lib/browser-manager";
import * as fs from "fs/promises";
import * as path from "path";

// Helper function to write content to file
async function writeToLogFile(test: Test, content: any) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const testId = test.id || 'unknown';
  const filePath = path.join(process.cwd(), 'logs', `test-${testId}-${timestamp}.txt`);
  
  // Ensure logs directory exists
  await fs.mkdir(path.join(process.cwd(), 'logs'), { recursive: true });
  
  // Create a formatted log with clear sections
  const logParts = [];
  
  // Add a header
  logParts.push(`=== TEST RESULTS: ${testId} (${new Date().toISOString()}) ===\n`);
  
  // Add test info
  logParts.push(`URL: ${test.url || 'No URL provided'}`);
  logParts.push(`Test Name: ${test.name || 'Unnamed Test'}`);
  logParts.push(`Description: ${test.description || 'No description'}\n`);
  
  // Add sections for different content types
  if (content.extractedData) {
    logParts.push(`\n=== SITE DESCRIPTION ===\n${content.extractedData.siteDescription || 'None'}\n`);
    
    logParts.push(`\n=== STEPS SUMMARY ===`);
    if (Array.isArray(content.extractedData.stepsSummary)) {
      content.extractedData.stepsSummary.forEach((step: string) => {
        logParts.push(step);
      });
    } else {
      logParts.push(String(content.extractedData.stepsSummary || 'None'));
    }
    
    logParts.push(`\n=== FINAL URL ===\n${content.extractedData.finalUrl || 'None'}\n`);
  }
  
  // Add journey details in a readable format
  if (content.returnObject?.journey) {
    logParts.push(`\n=== JOURNEY DETAILS ===`);
    content.returnObject.journey.forEach((step: any, index: number) => {
      logParts.push(`\nStep ${index + 1}: ${step.action.toUpperCase()}`);
      if (step.selector) logParts.push(`  Selector: ${step.selector}`);
      if (step.url) logParts.push(`  URL: ${step.url}`);
      if (step.text) logParts.push(`  Text: ${step.text}`);
      if (step.key) logParts.push(`  Key: ${step.key}`);
      if (step.values) logParts.push(`  Values: ${step.values.join(', ')}`);
    });
  }
  
  // Add raw data in JSON format at the end for reference
  logParts.push(`\n\n=== RAW DATA ===\n${JSON.stringify(content, null, 2)}`);
  
  // Join all parts with newlines
  const contentStr = logParts.join('\n');
  
  // Write to file
  await fs.writeFile(filePath, contentStr);
  console.log(`Results written to ${filePath}`);
  return filePath;
}

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
  const { tools, close } = await connectPlaywrightMCP(test.cdpEndpoint);

  const systemPrompt = `
  You are a senior QA engineer and Playwright MCP specialist. Your job is to drive an autonomous "expert tester" that uses only the Playwright MCP tools provided. Your main goal is to complete any form submission journey from start to finish.

  FORM COMPLETION STRATEGY:
  1. Start by taking a snapshot and identifying the type of form (authentication, signup, payment, survey, etc.)
  2. Systematically identify ALL required form fields by looking for '*' markers, 'required' attributes, or common patterns
  3. Fill form fields with appropriate valid test data:
     - Use "adoghri9@gmail.com" for email fields
     - Use "Test User" for name fields
     - Use "210 Fort York Blvd, ON, M5V4A1" for address fields
     - Use "647-904-1623" for phone fields
     - Use test credit card "4242 4242 4242 4242" with future expiry "12/28" and "123" CVV for payment forms
     - For other fields, provide relevant data that matches the expected format
  4. IMPORTANT: After filling fields in a section, look for "Next", "Continue", "Submit" or similar buttons BEFORE attempting to fill more fields
  5. VALIDATION HANDLING: If you encounter validation errors after clicking Next/Submit:
     - Take a new snapshot
     - Look for error messages (text in red, messages near fields, etc.)
     - Correct the problematic entries
     - Try submission again

  ACTION SEQUENCE:
  1. Snapshot the page and enumerate all interactive elements (links, buttons, form fields, dropdowns, etc.) visible
  2. Choose the highest-priority actions that move toward form completion
  3. After clicking Next/Continue/Submit buttons, ALWAYS take a new snapshot and verify progress before proceeding
  4. If the form has multiple pages/steps, identify the current step and complete it before moving to the next
  5. When you can no longer find form fields or submission buttons AND you see success indicators, conclude the journey

  ADVANCED TECHNIQUES:
  1. For multi-page forms, track your progress through the form steps
  2. If fields require specific formats (dates, phone numbers), ensure you format correctly
  3. If a field isn't immediately interactable, try clicking its label first
  4. Watch for dynamically appearing fields after selections are made
  5. Use keyboard press actions (Tab, PageDown) strategically if content appears to be below the visible area

  At the end, output this JSON object (no extra text):
     {
       "siteDescription": "A concise description of the website based on the landing page, including its purpose and main features",
       "journey": [
         { "action": "navigate",    "url": "..."              },
         { "action": "click",       "selector": "#buy-now"    },
         { "action": "type",        "selector": "input#email","text": "foo@bar.com" },
         { "action": "selectOption","selector":"select#qty",   "values": [ "2" ]    },
         { "action": "press",       "key": "PageDown"         },
         { "action": "click",       "selector": "button#submit"}
       ],
       "stepsSummary": ["Step 1: Navigated to the homepage", "Step 2: Clicked the buy now button", ...],
       "finalUrl": "<the URL you end up on>"
     }
  `.trim();

  // You might also refine the user prompt slightly if needed, but the system prompt usually has more impact on the agent's behavior.
  const userPrompt = `
  Given URL: ${url}

  1. Navigate to this URL using the 'browser_navigate' tool.
  2. Loop using the available tools:
     a. Take a snapshot to analyze the current state
     b. For forms: identify fields systematically, fill with appropriate test data, look for next/submit buttons
     c. For validation errors: identify them, correct entries, try again
     d. For multi-step forms: track current step and progress methodically
     e. Use strategic actions like PageDown if content might be below visible area
     f. Record each action with appropriate details

  3. After your first navigation to the URL, extract a concise description of the site.
  4. Track all steps taken and create a clear summary.
  5. Stop only when:
     - A form is successfully submitted (confirmation page or success message appears)
     - Or no further meaningful interactions are possible after thorough analysis

  Finally, emit exactly the JSON schema with "siteDescription", "journey", "stepsSummary" and "finalUrl."
  `.trim();

  console.log("Calling generateText with:", {
    model: "gpt-4.1-mini", //"gpt-4o",  // Upgraded to more capable model for complex form handling
    tools: !!tools,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.2,  // Slightly higher temperature for more creative problem-solving
    maxTokens: 8000,   // Increased token limit for more complex forms
    maxSteps: 35,      // Increased max steps for multi-page forms
    experimental_output: Output.object({ schema: urlSchema }),
  });

  // Prepare a log collection object to gather all outputs
  const fullLog: Record<string, any> = {
    initialData: {
      url,
      testId: test.id,
      timestamp: new Date().toISOString(),
    },
    promptData: {
      system: systemPrompt,
      user: userPrompt,
    },
  };

  let text, steps, toolCalls, toolResults, output, reasoning, sources, finishReason, usage;
  try {
    // Store the complete result first
    const result = await generateText({
      model: openai("gpt-4.1-mini" ), // Upgraded to more capable model "gpt-4o"
      system: systemPrompt,
      tools,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2, // Slightly higher temperature for more creative problem-solving
      maxTokens: 8000,  // Increased token limit
      maxSteps: 35,     // Increased max steps
      experimental_output: Output.object({ schema: urlSchema }),
    });

    // Add to log collection
    fullLog.rawResult = result;

    // Log response headers and body
    console.log("=== Results ===");
    console.log(JSON.stringify(result, null, 2));
    console.log("=== Response Headers ===");
    console.log(JSON.stringify(result.response?.headers, null, 2));
    console.log("=== Response Body ===");
    console.log(JSON.stringify(result.response?.body, null, 2));

    // Destructure the properties we need
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
    } = result);

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

  // Add steps data to log collection
  fullLog.stepDetails = [];
  steps.forEach((step, i) => {
    console.log(`\n--- STEP ${i + 1} (${step.stepType}) ---`);
    console.log("THE step:", step);
    console.log("finishReason:", step.finishReason);
    console.log("toolCalls:", step.toolCalls);
    console.log("toolResults:", step.toolResults);
    
    // Add to log collection
    fullLog.stepDetails.push({
      stepNumber: i + 1,
      stepType: step.stepType,
      finishReason: step.finishReason,
      toolCalls: step.toolCalls,
      toolResults: step.toolResults,
    });
  });

  // Log the raw output for debugging
  console.log("generateText returned (raw):", JSON.stringify({ text, toolCalls, toolResults, output }, null, 2));
  
  // Add structured outputs to log collection
  fullLog.structuredOutput = {
    text,
    toolCalls,
    toolResults,
    output,
  };

  // Log the new fields
  console.log("=== Site Description ===");
  console.log(output?.siteDescription || "No site description provided");
  
  console.log("=== Steps Summary ===");
  console.log(output?.stepsSummary || "No steps summary provided");
  
  // Add extracted data to log collection
  fullLog.extractedData = {
    siteDescription: output?.siteDescription || "No site description provided",
    stepsSummary: output?.stepsSummary || "No steps summary provided",
    finalUrl: output?.finalUrl,
  };

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
  
  // Add return object to log collection
  fullLog.returnObject = returnObject;
  
  // Write the complete log to a file
  const logFilePath = await writeToLogFile(test, fullLog);
  console.log(`Complete test results written to: ${logFilePath}`);
  
  return returnObject;
}
