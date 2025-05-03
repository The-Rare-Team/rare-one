import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ExploreRun } from "./generated/prisma/client";
import { connectPlaywrightMCP } from "@/lib/browser-manager";
import * as fs from "fs/promises";
import * as path from "path";

// Helper function to write content to file
async function writeToLogFile(exploreRun: ExploreRun, content: any) {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const testId = exploreRun.id || "unknown";
  const filePath = path.join(process.cwd(), "logs", `test-${testId}-${timestamp}.txt`);

  // Ensure logs directory exists
  await fs.mkdir(path.join(process.cwd(), "logs"), { recursive: true });

  // Create a formatted log with clear sections
  const logParts = [];

  // Add a header
  logParts.push(`=== TEST RESULTS: ${testId} (${new Date().toISOString()}) ===\n`);

  // Add test info
  logParts.push(`URL: ${exploreRun.url || "No URL provided"}`);
  logParts.push(`Test Name: ${exploreRun.name || "Unnamed Test"}`);
  logParts.push(`Description: ${exploreRun.description || "No description"}\n`);

  // Add error information if present
  if (content.error) {
    logParts.push(`\n=== ERROR INFORMATION ===`);
    logParts.push(`Error Type: ${content.error.type || "Unknown"}`);
    logParts.push(`Error Message: ${content.error.message || "No message"}`);

    if (content.error.retryAttempts) {
      logParts.push(`Retry Attempts: ${content.error.retryAttempts}`);
    }

    if (content.error.details) {
      logParts.push(`Error Details: ${JSON.stringify(content.error.details, null, 2)}`);
    }
    logParts.push(""); // Add empty line
  }

  // Add sections for different content types
  if (content.extractedData) {
    logParts.push(`\n=== SITE DESCRIPTION ===\n${content.extractedData.siteDescription || "None"}\n`);

    logParts.push(`\n=== STEPS SUMMARY ===`);
    if (Array.isArray(content.extractedData.stepsSummary)) {
      content.extractedData.stepsSummary.forEach((step: string) => {
        logParts.push(step);
      });
    } else {
      logParts.push(String(content.extractedData.stepsSummary || "None"));
    }

    logParts.push(`\n=== FINAL URL ===\n${content.extractedData.finalUrl || "None"}\n`);
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
      if (step.values) logParts.push(`  Values: ${step.values.join(", ")}`);
    });
  }

  // Add detailed step execution information
  if (content.stepDetails && content.stepDetails.length > 0) {
    logParts.push(`\n\n=== DETAILED STEP EXECUTION ===`);
    content.stepDetails.forEach((stepDetail: any) => {
      logParts.push(`\n--- STEP ${stepDetail.stepNumber} (${stepDetail.stepType}) ---`);
      logParts.push(`  Finish Reason: ${JSON.stringify(stepDetail.finishReason)}`);

      if (stepDetail.toolCalls && stepDetail.toolCalls.length > 0) {
        logParts.push(`  Tool Calls:`);
        stepDetail.toolCalls.forEach((call: any, idx: number) => {
          logParts.push(`    Call ${idx + 1}: ${call.name} - ${JSON.stringify(call.args)}`);
        });
      }

      if (stepDetail.toolResults && stepDetail.toolResults.length > 0) {
        logParts.push(`  Tool Results:`);
        stepDetail.toolResults.forEach((result: any, idx: number) => {
          logParts.push(`    Result ${idx + 1}: ${JSON.stringify(result)}`);
        });
      }
    });
  }

  // Add raw data in JSON format at the end for reference
  logParts.push(`\n\n=== RAW DATA ===\n${JSON.stringify(content, null, 2)}`);

  // Join all parts with newlines
  const contentStr = logParts.join("\n");

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

export async function runAIAgent(exploreRun: ExploreRun) {
  const url = exploreRun.url;
  const { tools, close } = await connectPlaywrightMCP(exploreRun.cdpEndpoint);

  const systemPrompt = `
  You are a senior QA engineer and Playwright MCP specialist. Your job is to drive an autonomous "expert tester" that uses only the Playwright MCP tools provided. Your main goal is to complete any form submission journey from start to finish, calling exactly one browser tool at a time, then waiting 1 second, then taking a new snapshot before any further action.
  
  FORM COMPLETION STRATEGY:
  1. Start by taking an initial snapshot to identify the type of form.
  2. Identify required fields (* markers, required attributes, common patterns).
  3. Fill each field with valid test data (emails, names, addresses, etc.).
  4. After filling each logical group of fields, look for Next/Continue/Submit buttons before proceeding.
  5. On validation errors: take snapshot, locate error messages, correct entries, retry submission.
  
  ACTION SEQUENCE RULE:
  - **Only one** of [browser_navigate, browser_click, browser_type, browser_selectOption, browser_press] per step.
  - Immediately after that tool call, invoke 'browser_wait({ ms: 1000 })'.
  - Then invoke 'browser_snapshot()' before planning the next action.
  
  DEALING WITH DYNAMIC CONTENT:
  - Always follow any interaction with:
     1. 'browser_wait({ms:1000})'
     2. 'browser_snapshot()'
  - If you get stale references, retry on the fresh snapshot.


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

  const userPrompt = `
  Given URL: ${url}

  1. Call exactly **one** browser tool per loop iteration:
    a. Take snapshot: 'browser_snapshot()'
    b. Analyze form or page state.
    c. If interacting, choose one of:
        - 'browser_navigate(...)'
        - 'browser_click(...)'
        - 'browser_type(...)'
        - 'browser_selectOption(...)'
        - 'browser_press(...)'
    d. Immediately call 'browser_wait({ms:1000})'
    e. Immediately call 'browser_snapshot()'
  2. Repeat until:
    - Form is successfully submitted (detect success message/page), or
    - No further meaningful actions are possible.
  3. Meanwhile, record each action into your journey array and build stepsSummary.
  4. When done, emit exactly the JSON schema with keys:
    - siteDescription
    - journey
    - stepsSummary
    - finalUrl
  `.trim();

  // Prepare a log collection object to gather all outputs
  const fullLog: Record<string, any> = {
    initialData: {
      url,
      testId: exploreRun.id,
      timestamp: new Date().toISOString(),
    },
    promptData: {
      system: systemPrompt,
      user: userPrompt,
    },
  };

  let text, steps, toolCalls, toolResults, output, reasoning, sources, finishReason, usage;
  try {
    // Define the model without the .withRetry() chain
    const model = openai("gpt-4.1-mini");

    const result = await generateText({
      model, // Pass the base model instance
      system: systemPrompt,
      tools,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.1,
      maxTokens: 20000,
      maxSteps: 35,
      frequencyPenalty: 0.2, // to avoid repeating same lines or phrases
      experimental_continueSteps: true, // Enables only full tokens to be streamed out 
      experimental_output: Output.object({ schema: urlSchema }), // forces a json output 
      maxRetries: 5, // exponential back off 
    });

    // Add to log collection
    fullLog.rawResult = result;

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
  } catch (error) {
    console.error("Error during AI agent execution:", error);

    // Add error information to the log
    fullLog.error = {
      type: typeof error === "object" && error !== null ? (error as any).name || "Unknown" : "Unknown",
      message: typeof error === "object" && error !== null ? (error as any).message || "No message" : String(error),
      details: error,
    };

    // Write error to log file
    const logFilePath = await writeToLogFile(exploreRun, fullLog);
    console.log(`Error results written to: ${logFilePath}`);

    // Rethrow the error after logging
    throw error;
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

    // Add to log collection with more detailed information
    fullLog.stepDetails.push({
      stepNumber: i + 1,
      stepType: step.stepType,
      finishReason: step.finishReason,
      toolCalls: step.toolCalls,
      toolResults: step.toolResults,
      fullStepDetails: step, // Include the full step object for comprehensive logging
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
  const logFilePath = await writeToLogFile(exploreRun, fullLog);
  console.log(`Complete test results written to: ${logFilePath}`);

  return returnObject;
}
