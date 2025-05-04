import { generateText, Output, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ExploreRun } from "./generated/prisma/client";
import { connectPlaywrightMCP } from "@/lib/browser-manager";
import * as fs from "fs/promises";
import * as path from "path";
// import { ToolCallPart } from "@ai-sdk/provider"; // Import type if needed -- Removed due to type issue

// Helper function to identify submit attempts
function isSubmitAttempt(toolCall: any): boolean {
  if (toolCall?.toolName !== "browser_click") {
    return false;
  }
  const selector = toolCall.args?.selector?.toLowerCase() || "";
  // Basic check for common submit patterns in selectors or button text implied by selectors
  const submitPatterns = /submit|continue|next|confirm|pay|order|checkout|complete|finish|add to cart/i;
  if (submitPatterns.test(selector)) {
    return true;
  }
  // Check for type="submit"
  if (selector.includes('[type="submit"]')) {
    return true;
  }
  return false;
}

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

  // Add the real-time logs from onStepFinish
  if (content.onStepFinishLogs && content.onStepFinishLogs.length > 0) {
    logParts.push(`\n\n=== REAL-TIME STEP LOGS (from onStepFinish & final loop) ===`);
    content.onStepFinishLogs.forEach((logEntry: string) => {
      logParts.push(logEntry);
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
  You are a senior QA engineer and Playwright MCP specialist. Your job is to drive an autonomous "expert tester" that uses only the Playwright MCP tools provided. Your main goal is to complete any form submission journey from start to finish, calling browser tools strategically.

  FORM COMPLETION STRATEGY:
  1. Start by taking an initial snapshot to identify the type of form.
  2. Identify required fields (* markers, required attributes, common patterns).
  3. **Fill fields top-to-bottom:** Identify all visible input fields and fill them sequentially from the top of the page to the bottom, mimicking how a human would typically interact with the form.
     - Use valid test data. For phone number fields, use "778 996 8081".
     - Fill related fields sequentially if it makes sense before taking a snapshot, especially if the UI seems stable.
  4. After filling a logical group of fields or before critical actions (like submitting or navigating sections), take a snapshot ('browser_snapshot()') to verify the state.
  5. **Error Handling (especially after clicking "Next" or Submit):**
     - **Immediately after** clicking a button intended to submit or proceed (like "Next", "Submit", "Continue"), **call 'browser_snapshot()'**.
     - **Analyze the snapshot:** Look for any validation error messages, warnings, or indicators that the submission failed or the page didn't advance as expected.
     - **If errors are found:** Identify the fields causing errors, use 'browser_type' or other tools to correct the inputs, and then attempt the submission click again.
     - **If no errors are found and the page advanced:** Continue with the next step in the form.
  6. Use 'browser_wait({ ms: ... })' sparingly, only when you anticipate the page needing time to update (e.g., after navigation, form submission, or complex UI interactions). A short wait (e.g., 200-500ms) might suffice often. Default to no wait if unsure.

  ACTION SEQUENCE GUIDELINES:
  - Prioritize completing the task efficiently.
  - Call 'browser_snapshot()' when you need to analyze the current page state to decide the next action, especially after navigation or potential UI updates.
  - Call 'browser_wait({ms: ...})' *only* when necessary for the page to stabilize after an action. Avoid unnecessary waits.
  - You can call multiple 'browser_type' or similar simple actions before the next snapshot if the form structure allows.
  - **If you find yourself attempting the exact same tool call  action on the same element multiple times in a row, call 'browser_snapshot()' immediately to re-evaluate the page state before trying the same action again or moving on.**

  DEALING WITH DYNAMIC CONTENT:
  - If an action fails or the page state seems incorrect (e.g., stale references), use 'browser_snapshot()' to get the latest view before retrying or planning the next step. A short 'browser_wait' might be needed before the snapshot if the failure was likely due to timing.


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

  Follow the FORM COMPLETION STRATEGY and ACTION SEQUENCE GUIDELINES from the system prompt.
  1. Use browser tools like 'browser_snapshot()', 'browser_navigate(...)', 'browser_click(...)', 'browser_type(...)', 'browser_selectOption(...)', 'browser_press(...)'.
  2. Use 'browser_wait({ms: ...})' only when needed for page stabilization (e.g., 200-500ms, or longer if required after navigation/submission).
  3. Use 'browser_snapshot()' strategically to observe results and plan next steps, not necessarily after every single action.
  4. Repeat until:
     - Form is successfully submitted (detect success message/page), or
     - No further meaningful actions are possible.
  5. Record each action into your journey array and build stepsSummary.
  6. When done, emit exactly the JSON schema with keys:
    - siteDescription
    - journey
    - stepsSummary
    - finalUrl
  `.trim();

  // Prepare messages array
  const initialMessages: CoreMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

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
    onStepFinishLogs: [], // Initialize array for onStepFinish logs
  };

  let text, steps, toolCalls, toolResults, output, reasoning, sources, finishReason, usage;
  let stepCounter = 0; // Initialize step counter

  // Timeout setup
  const controller = new AbortController();
  const timeoutDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
  const timeoutId = setTimeout(() => {
    console.warn(`Operation timed out after ${timeoutDuration / 60000} minutes. Aborting...`);
    controller.abort();
  }, timeoutDuration);

  try {
    // Define the model without the .withRetry() chain
    const model = openai("gpt-4.1-mini");

    const result = await generateText({
      model, // Pass the base model instance
      messages: initialMessages, // Use messages array
      tools,
      temperature: 0.1,
      maxTokens: 20000,
      maxSteps: 100, // Keeping maxSteps > 1 for now
      frequencyPenalty: 0.2, // to avoid repeating same lines or phrases
      experimental_continueSteps: true, // Enables only full tokens to be streamed out
      experimental_output: Output.object({ schema: urlSchema }), // forces a json output
      maxRetries: 5, // exponential back off
      abortSignal: controller.signal, // Pass the abort signal
      experimental_telemetry: { isEnabled: true }, // Enable OpenTelemetry
      experimental_prepareStep: async (step) => {
        // Boilerplate for experimental_prepareStep
        console.log(`INFO: Preparing Step Number: ${step.stepNumber}`);

        // Access previous steps and messages:
        const previousSteps = step.steps; // Array of StepResult objects from previous steps
        // const allMessages = step.messages; // Full message history - Removed, not directly available in step object
        const lastStep = previousSteps[previousSteps.length - 1];

        // Example: Log tool calls from the last step (if any)
        if (lastStep?.toolCalls && lastStep.toolCalls.length > 0) {
          console.log("INFO: Tool calls in last step:", lastStep.toolCalls);
        }

        // --- Decision Logic ---
        // Based on previousSteps or stepNumber, decide if overrides are needed.
        const overrideModel: any = undefined; // Or potentially openai('gpt-3.5-turbo') etc.
        const overrideToolChoice: any = undefined; // Or { type: 'tool', toolName: '...' }, { type: 'required' }, etc.
        const overrideActiveTools: string[] | undefined = undefined; // Or ['toolA', 'toolB']

        // Example Condition: Switch to a specific tool after step 5
        // if (step.stepNumber > 5) {
        //   console.log("INFO: Forcing specific tool after step 5");
        //   overrideToolChoice = { type: 'tool', toolName: 'browser_snapshot' };
        //   overrideActiveTools = ['browser_snapshot', 'browser_wait'];
        // }

        // --- Return Overrides ---
        // Only include properties you want to override for the *next* step.
        // Returning an empty object means no overrides.
        const overrides: any = {};
        if (overrideModel) overrides.model = overrideModel;
        if (overrideToolChoice) overrides.toolChoice = overrideToolChoice;
        if (overrideActiveTools) overrides.experimental_activeTools = overrideActiveTools;

        return overrides;
      },
      experimental_repairToolCall: async ({ toolCall }) => {
        console.log(`INFO: [Repair Check] Checking tool call for ${toolCall.toolName}`);
        const { args } = toolCall;

        // Basic check: Log argument type and attempt JSON parse if string
        if (typeof args === "string") {
          try {
            JSON.parse(args);
            console.log(`INFO: [Repair Check] Args for ${toolCall.toolName} is a valid JSON string.`);
          } catch (error: any) {
            console.warn(
              `WARN: [Repair Check] Args for ${toolCall.toolName} is a string but failed JSON parsing: ${error.message}`,
            );
            console.warn(`WARN: [Repair Check] Original string args:`, args);
            // No repair attempted here, just logging.
          }
        } else if (typeof args === "object" && args !== null) {
          console.log(`INFO: [Repair Check] Args for ${toolCall.toolName} is an object.`);
          // Further validation could happen here, but keeping it simple to avoid type issues.
        } else {
          console.log(`INFO: [Repair Check] Args for ${toolCall.toolName} is of type: ${typeof args}`);
        }

        // This hook now primarily serves as a logging/observation point.

        // Return the original tool call, letting the tool execution handle potential errors.
        return toolCall;
      },
      onStepFinish: async (stepResult) => {
        stepCounter++; // Increment step counter
        // Capture step info for the log file instead of console
        fullLog.onStepFinishLogs.push(`--- onStepFinish: Step ${stepCounter} ---`);
        fullLog.onStepFinishLogs.push(`  Finish Reason: ${JSON.stringify(stepResult.finishReason)}`);
        fullLog.onStepFinishLogs.push(`  Tool Calls: ${JSON.stringify(stepResult.toolCalls)}`);
        fullLog.onStepFinishLogs.push(`  Tool Results: ${JSON.stringify(stepResult.toolResults)}`);
        fullLog.onStepFinishLogs.push(`  Usage: ${JSON.stringify(stepResult.usage)}`);
      },
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
    clearTimeout(timeoutId); // Clear the timeout if operation finished or errored
    close();
  }

  // Add steps data to log collection
  fullLog.stepDetails = [];
  steps.forEach((step, i) => {
    // Capture final step details for the log file
    fullLog.onStepFinishLogs.push(`--- Final Loop: Step ${i + 1} (${step.stepType}) ---`);
    fullLog.onStepFinishLogs.push(`  Full Details: ${JSON.stringify(step)}`);

    // Add to log collection with more detailed information (for structured stepDetails section)
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
