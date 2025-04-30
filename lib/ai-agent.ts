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
  
  // Add error information if present
  if (content.error) {
    logParts.push(`\n=== ERROR INFORMATION ===`);
    logParts.push(`Error Type: ${content.error.type || 'Unknown'}`);
    logParts.push(`Error Message: ${content.error.message || 'No message'}`);
    
    if (content.error.retryAttempts) {
      logParts.push(`Retry Attempts: ${content.error.retryAttempts}`);
    }
    
    if (content.error.details) {
      logParts.push(`Error Details: ${JSON.stringify(content.error.details, null, 2)}`);
    }
    logParts.push(''); // Add empty line
  }
  
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
  
  // Add rate limit information if present
  if (content.rateLimitInfo) {
    logParts.push(`\n\n=== RATE LIMIT INFORMATION ===`);
    logParts.push(`Total Retry Attempts: ${content.rateLimitInfo.totalRetries || 0}`);
    
    if (content.rateLimitInfo.retryEvents && content.rateLimitInfo.retryEvents.length > 0) {
      logParts.push(`\nRetry Events:`);
      content.rateLimitInfo.retryEvents.forEach((event: any, idx: number) => {
        logParts.push(`  Event ${idx + 1}:`);
        logParts.push(`    Time: ${event.time}`);
        logParts.push(`    Delay: ${event.delayMs}ms`);
        logParts.push(`    Reason: ${event.reason || 'Unknown'}`);
      });
    }
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

// Helper function to implement exponential backoff for API calls
/**
 * Executes a function with exponential backoff retry for API rate limit errors.
 * This specifically handles OpenAI's 429 rate limit errors by:
 * 1. Detecting rate limit errors through status codes or error messages
 * 2. Using the server's retry-after header when available
 * 3. Implementing exponential backoff with a maximum delay cap
 * 4. Limiting total retry attempts
 */
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  initialDelayMs = 1000,
  maxDelayMs = 30000,
  rateLimitInfo?: { totalRetries: number; retryEvents: any[] }
): Promise<T> {
  let retries = 0;
  let delay = initialDelayMs;
  
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      // Handle different error object structures
      // The AI SDK can wrap errors in different ways
      const originalError = error?.lastError || error;
      
      // Check if it's a rate limit error (429)
      const isRateLimit = 
        originalError?.statusCode === 429 || 
        originalError?.data?.error?.code === 'rate_limit_exceeded' ||
        error?.message?.includes('rate limit') ||
        originalError?.message?.includes('rate limit');
      
      if (!isRateLimit || retries >= maxRetries) {
        // Rethrow if not a rate limit error or if we've exceeded max retries
        console.log(`Error not retryable or max retries (${maxRetries}) exceeded:`, error);
        throw error;
      }
      
      // Extract retry-after from headers if available
      let retryAfterMs = delay;
      
      // Try different paths to find the retry-after value
      const headers = originalError?.responseHeaders || {};
      
      if (headers['retry-after-ms']) {
        retryAfterMs = Number(headers['retry-after-ms']);
      } else if (headers['retry-after']) {
        retryAfterMs = Number(headers['retry-after']) * 1000;
      } else if (originalError?.data?.error?.message) {
        // Try to extract seconds from the error message
        const match = originalError.data.error.message.match(/try again in (\d+\.?\d*)s/i);
        if (match && match[1]) {
          retryAfterMs = Number(match[1]) * 1000;
        }
      }
      
      // Track retry information if rateLimitInfo is provided
      if (rateLimitInfo) {
        rateLimitInfo.totalRetries++;
        rateLimitInfo.retryEvents.push({
          time: new Date().toISOString(),
          delayMs: retryAfterMs,
          reason: originalError?.data?.error?.message || error?.message || 'Rate limit exceeded',
          attempt: retries + 1
        });
      }
      
      // Log the retry attempt with detailed information
      console.log(`Rate limit hit. Retrying in ${retryAfterMs/1000}s (attempt ${retries + 1}/${maxRetries})`);
      console.log(`Rate limit details: ${originalError?.data?.error?.message || 'No detailed message'}`);
      
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, retryAfterMs));
      
      // Increase the delay for the next retry (exponential backoff)
      delay = Math.min(delay * 2, maxDelayMs);
      retries++;
    }
  }
}

export async function runAIAgent(test: Test) {
  const url = test.url;
  const { tools, close } = await connectPlaywrightMCP(test.cdpEndpoint);

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
      testId: test.id,
      timestamp: new Date().toISOString(),
    },
    promptData: {
      system: systemPrompt,
      user: userPrompt,
    },
    rateLimitInfo: {
      totalRetries: 0,
      retryEvents: []
    }
  };

  let text, steps, toolCalls, toolResults, output, reasoning, sources, finishReason, usage;
  try {
    // Create a counter for retries that the withExponentialBackoff function can modify
    const retryCounter = { count: 0, events: [] };

    // Store the complete result first - Now with exponential backoff
    const result = await withExponentialBackoff(async () => {
      console.log("Attempting generateText call...");
      return generateText({
        model: openai("gpt-4.1-mini"), // Upgraded to more capable model "gpt-4o"
        system: systemPrompt,
        tools,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.1, 
        maxTokens: 20000,
        maxSteps: 35,
        experimental_continueSteps: true,
        experimental_output: Output.object({ schema: urlSchema }),
      });
    }, 5, 2000, 60000, fullLog.rateLimitInfo);

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

  } catch (error) {
    console.error("Error during AI agent execution:", error);
    
    // Add error information to the log
    fullLog.error = {
      type: typeof error === 'object' && error !== null ? (error as any).name || "Unknown" : "Unknown",
      message: typeof error === 'object' && error !== null ? (error as any).message || "No message" : String(error),
      details: error
    };

    // Write error to log file
    const logFilePath = await writeToLogFile(test, fullLog);
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
      fullStepDetails: step // Include the full step object for comprehensive logging
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
