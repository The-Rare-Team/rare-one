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
  You are a senior QA engineer and Playwright MCP specialist. Your task is to complete form submissions using only the provided Playwright MCP tools.

  KEY STRATEGIES:
  1. Start with a snapshot to identify form type
  2. Identify required fields (look for * markers, required attributes)
  3. Fill fields top-to-bottom with valid test data (phone: "778 996 8081", email: "amandazown@gmail.com")
  4. Take snapshots after filling field groups or before critical actions
  5. After clicking submit/next buttons:
     - Take a snapshot to check for errors
     - Fix any errors and retry submission if needed
     - IMPORTANT: If validation errors are found, verify each field value again and re-enter any incorrect or missing values
     - IMPORTANT: When form errors occur, verify individual fields by checking for error messages, and fill each field again separately
  6. Use wait commands sparingly (200-500ms) only when necessary

  SNAPSHOT GUIDANCE:
  - CRITICAL: Take snapshots frequently to maintain fresh element references
  - ALWAYS take a manual snapshot after critical actions like clicks or navigation
  - ALWAYS take a snapshot before starting to fill out a form or after navigation
  - ALWAYS take a snapshot immediately after any error occurs
  - Manual snapshots with browser_snapshot() are more reliable than automatic ones

  ELEMENT TYPE VALIDATION:
  - CRITICAL: Before using browser_type(), verify the element is a valid input field, textarea, or select
  - For button elements, NEVER use browser_type() - use browser_click() instead
  - Element references like 's2e10' may be ambiguous - check snapshot to determine element type
  - If browser_type() fails with "Element is not an <input>, <textarea>", use browser_click() instead
  - For radio buttons or checkboxes, use browser_click() rather than browser_type()

  HANDLING REFERENCES:
  - CRITICAL: Always use element references from the MOST RECENT SNAPSHOT (highest snapshot number)
  - References like 's1e149' or 's5e27' include snapshot numbers (s1, s5) - always use the highest snapshot number
  - After each snapshot, previous element references become STALE and MUST NOT be used
  - If you see "Error: Stale aria-ref", take a new snapshot and use fresh references

  EFFICIENT ACTIONS:
  - Use snapshots to analyze page state before deciding next actions
  - Chain simple actions when UI is stable
  - Add minimal waits between actions only when needed
  - IMPORTANT: After filling a form field, verify it actually contains the data you intended to enter before proceeding
  - IMPORTANT: For text fields with validation errors, try clearing the field first before re-entering data

  Output JSON when complete:
  {
    "siteDescription": "Brief site description",
    "journey": [
      { "action": "navigate", "url": "..." },
      { "action": "click", "selector": "#example" },
      // Only include navigate/click/type/selectOption/press actions
    ],
    "stepsSummary": ["Step descriptions..."],
    "finalUrl": "final URL"
  }
  `.trim();

  const userPrompt = `
  Given URL: ${url}

  Navigate to the URL and complete the form. Use tools like browser_snapshot(), browser_navigate(), browser_click(), browser_type(), browser_selectOption(), and browser_press().
  
  CRITICAL SNAPSHOTS:
  - ALWAYS call browser_snapshot() after navigation, clicks, or before filling forms
  - Take frequent manual snapshots - don't rely on automatic snapshots
  - After any error occurs, immediately take a new snapshot
  - Remember to take a snapshot before and after form submission attempts
  
  IMPORTANT FOR ELEMENT TYPES:
  - ALWAYS take a snapshot before interacting with elements
  - Carefully check element types in snapshots before using them
  - Use browser_type() ONLY for input, textarea, and contenteditable elements
  - Use browser_click() for buttons, links, checkboxes, and radio buttons
  - If you get "Element is not an <input>" errors, use browser_click() instead
  
  IMPORTANT FOR FORM VALIDATION:
  - After entering data in a field, verify it contains the correct value
  - After clicking "Next" or "Submit", always take a snapshot to check for validation errors
  - If errors are found, check each field individually and re-enter data as needed
  - For fields with errors, try clearing the field with browser_type(selector, ""), then re-enter the data
  
  Continue until form submission is successful or no further actions are possible.
  
  Return a JSON with siteDescription, journey, stepsSummary, and finalUrl.
  `.trim();

  // Initialize messages with only system and user messages
  let messages: CoreMessage[] = [
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

  // Storage for manual accumulation of steps, tool calls, and results
  const allSteps: any[] = [];
  const allToolCalls: any[] = [];
  const allToolResults: any[] = [];
  let stepCounter = 0;
  let finalOutput: any = null;

  // Timeout setup
  const controller = new AbortController();
  const timeoutDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
  const timeoutId = setTimeout(() => {
    console.warn(`Operation timed out after ${timeoutDuration / 60000} minutes. Aborting...`);
    controller.abort();
  }, timeoutDuration);

  // Add constants for timing and snapshots
  const AUTO_SNAPSHOT_DELAY_MS = 2000; // Delay before taking automatic snapshots
  const AUTO_SNAPSHOT_ACTIONS = ["browser_click", "browser_type", "browser_navigate"]; // Actions that should trigger automatic snapshots

  // Helper function for taking snapshots programmatically
  async function takeAutoSnapshot(browserTools: Record<string, any>): Promise<any> {
    console.log("Taking automatic snapshot after action...");
    try {
      // Add a small delay to ensure page has updated
      await new Promise((resolve) => setTimeout(resolve, AUTO_SNAPSHOT_DELAY_MS));

      // Log available tools to help with debugging
      console.log("Available browser tools:", Object.keys(browserTools));

      // Inspect each tool to find a valid snapshot tool
      let snapshotTool = null;

      // Check each tool for proper structure and handler
      for (const [key, tool] of Object.entries(browserTools)) {
        console.log(`Inspecting tool: ${key}`);

        // Check if this might be a snapshot tool
        const isSnapshotTool =
          key === "browser_snapshot" ||
          (tool.name && typeof tool.name === "string" && tool.name.includes("snapshot")) ||
          key.includes("snapshot");

        if (isSnapshotTool) {
          console.log(`Found potential snapshot tool: ${key}`);
          console.log(
            `Tool structure:`,
            JSON.stringify({
              hasName: !!tool.name,
              name: tool.name,
              hasHandler: !!tool.handler,
              handlerType: typeof tool.handler,
            }),
          );

          // Validate that it has a proper handler function
          if (tool.handler && typeof tool.handler === "function") {
            snapshotTool = tool;
            console.log(`Selected snapshot tool: ${key}`);
            break;
          }
        }
      }

      if (!snapshotTool) {
        // Try direct property access for standard MCP tools format
        if (browserTools.browser_snapshot && typeof browserTools.browser_snapshot.handler === "function") {
          console.log("Found snapshot tool via direct property access");
          snapshotTool = browserTools.browser_snapshot;
        }
      }

      if (!snapshotTool) {
        console.warn("No valid snapshot tool found in available tools!");
        return null;
      }

      console.log(`Using snapshot tool: ${snapshotTool.name || "unnamed"}`);
      const snapshotResult = await snapshotTool.handler({});
      return {
        toolName: snapshotTool.name || "browser_snapshot",
        args: {},
        result: snapshotResult,
      };
    } catch (error) {
      console.error("Error taking automatic snapshot:", error);
      return null;
    }
  }

  try {
    // Define the model without the .withRetry() chain
    const model = openai("gpt-4.1-mini");
    const maxIterations = 100; // Maximum number of iterations to prevent infinite loops
    let iteration = 0;
    let isDone = false;

    // Main conversation loop
    while (iteration < maxIterations && !isDone) {
      iteration++;
      console.log(`Executing iteration ${iteration}...`);

      // For each iteration, we'll use a managed context:
      // 1. Always include system & user prompts
      // 2. Add relevant recent messages (especially snapshot results)
      // 3. Limit context size to prevent token overflow

      // Base messages always include system and user prompts
      const baseMessages: CoreMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      // For the context management, use a simple approach
      const recentMessageCount = 5; // Consider last 5 messages most important for context
      const managedMessages: CoreMessage[] = [
        ...baseMessages,
        ...messages.slice(Math.max(0, messages.length - recentMessageCount)),
      ];

      // Use the appropriate messages for this iteration
      const messagesForThisIteration = messages.length > 2 ? managedMessages : messages;

      const result = await generateText({
        model,
        messages: messagesForThisIteration,
        tools,
        temperature: 0.1,
        maxTokens: 20000,
        maxSteps: 1, // Use maxSteps: 1 as requested
        frequencyPenalty: 0.2,
        abortSignal: controller.signal,
        experimental_telemetry: { isEnabled: true },
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
            }
          } else if (typeof args === "object" && args !== null) {
            console.log(`INFO: [Repair Check] Args for ${toolCall.toolName} is an object.`);
          } else {
            console.log(`INFO: [Repair Check] Args for ${toolCall.toolName} is of type: ${typeof args}`);
          }

          return toolCall;
        },
        onStepFinish: async (stepResult) => {
          stepCounter++;
          // Capture step info for the log file
          fullLog.onStepFinishLogs.push(`--- onStepFinish: Step ${stepCounter} ---`);
          fullLog.onStepFinishLogs.push(`  Finish Reason: ${JSON.stringify(stepResult.finishReason)}`);
          fullLog.onStepFinishLogs.push(`  Tool Calls: ${JSON.stringify(stepResult.toolCalls)}`);
          fullLog.onStepFinishLogs.push(`  Tool Results: ${JSON.stringify(stepResult.toolResults)}`);
          fullLog.onStepFinishLogs.push(`  Usage: ${JSON.stringify(stepResult.usage)}`);
        },
      });

      // Accumulate result data
      if (result.steps.length > 0) {
        allSteps.push(result.steps[0]);
      }

      // Handle the assistant response
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Add tool calls to our tracking
        allToolCalls.push(...result.toolCalls);

        // Debug logging for each tool call
        console.log(`\n==== TOOL CALLS (Iteration ${iteration}) ====`);
        result.toolCalls.forEach((tc, idx) => {
          console.log(`  [${idx + 1}] Tool: ${tc.toolName}`);
          console.log(`      Args: ${JSON.stringify(tc.args)}`);
          console.log(`      CallId: ${tc.toolCallId || "unknown"}`);
        });

        // Create a new assistant message with the tool calls
        const assistantMessage: CoreMessage = {
          role: "assistant",
          content: result.text || "",
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.toolCallId || `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type: "function",
            function: {
              name: tc.toolName,
              arguments: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
            },
          })),
        } as CoreMessage;

        // Add the assistant message with tool calls
        messages.push(assistantMessage);

        // If we have tool results, create a new user message with the results
        if (result.toolResults && result.toolResults.length > 0) {
          allToolResults.push(...result.toolResults);

          // Debug logging for each tool result
          console.log(`\n==== TOOL RESULTS (Iteration ${iteration}) ====`);
          result.toolResults.forEach((tr, idx) => {
            const correspondingTool = idx < result.toolCalls.length ? result.toolCalls[idx].toolName : "auto-snapshot";
            console.log(`  [${idx + 1}] For tool: ${correspondingTool}`);
            const hasError = tr.result?.isError === true;
            console.log(`      Status: ${hasError ? "ERROR" : "SUCCESS"}`);
            if (hasError) {
              console.log(`      Error: ${JSON.stringify(tr.result?.content)}`);
            } else {
              console.log(
                `      Result: ${JSON.stringify(tr.result).substring(0, 150)}${JSON.stringify(tr.result).length > 150 ? "..." : ""}`,
              );
            }
          });

          // Check if we should take an automatic snapshot after this action
          let snapshotTaken = false;
          for (const toolCall of result.toolCalls) {
            if (AUTO_SNAPSHOT_ACTIONS.includes(toolCall.toolName)) {
              // Take an automatic snapshot after important actions
              console.log(`Auto-snapshot triggered after ${toolCall.toolName} action`);
              const snapshotResult = await takeAutoSnapshot(tools);

              if (snapshotResult) {
                snapshotTaken = true;
                console.log("Auto-snapshot successful");
                // Add snapshot result to our tracking
                allToolResults.push(snapshotResult);
                // Add snapshot information to the results we'll show the model
                result.toolResults.push(snapshotResult);
              } else {
                console.log("Auto-snapshot failed, continuing without snapshot");
                // Just log the failure but don't try to add a custom message to results
                // This avoids type compatibility issues
              }
              break; // Only take one snapshot per iteration
            }
          }

          // Format all tool results into a single user message with the combined information
          const formattedResults = result.toolResults
            .map((toolResult, index) => {
              const isAutoSnapshot = index >= result.toolCalls.length; // Auto snapshots are appended after the original tool results

              const toolName = isAutoSnapshot
                ? "browser_snapshot (automatic)"
                : result.toolCalls && index < result.toolCalls.length
                  ? result.toolCalls[index].toolName
                  : "unknown";

              // Check if there's an error in the result
              const hasError = toolResult.result?.isError === true;
              const errorDetails =
                hasError && toolResult.result?.content
                  ? Array.isArray(toolResult.result.content)
                    ? toolResult.result.content.map((c: any) => c.text || "").join("\n")
                    : String(toolResult.result.content)
                  : "";

              // Enhance the feedback with error information
              let feedback = `Tool: ${toolName}\n`;

              if (isAutoSnapshot) {
                feedback = `Tool: ${toolName}\nSTATUS: AUTO_SNAPSHOT\nThis snapshot was automatically taken after your previous action to show the current page state.\n`;
              } else if (hasError) {
                feedback += `STATUS: ERROR\n`;
                feedback += `Error Details: ${errorDetails}\n`;

                // Add guidance based on error type
                if (errorDetails.includes("Element is not an <input>, <textarea>")) {
                  if (toolName === "browser_type" && errorDetails.includes("radiogroup")) {
                    feedback +=
                      "GUIDANCE: For radiogroup elements, use browser_click on the specific radio option instead of browser_type.\n";
                  } else if (toolName === "browser_type" && errorDetails.includes("button")) {
                    feedback +=
                      "GUIDANCE: This is a BUTTON element which doesn't accept text input. Use browser_click instead.\n";
                  } else if (toolName === "browser_type") {
                    feedback +=
                      "GUIDANCE: The element doesn't support text input. Check the snapshot carefully and identify a proper input field, or use browser_click if this is a clickable element.\n";
                    feedback +=
                      "ACTION REQUIRED: Take a new snapshot first, then inspect the page structure to find the correct input fields.\n";
                  } else {
                    feedback +=
                      "GUIDANCE: The element doesn't support text input. Consider using browser_click or check if it's the correct element.\n";
                  }
                } else if (errorDetails.includes("Execution context was destroyed")) {
                  feedback += "GUIDANCE: The page navigated during the operation. Take a new snapshot and retry.\n";
                }
              } else {
                feedback += "STATUS: SUCCESS\n";
              }

              feedback += `Result: ${JSON.stringify(toolResult)}\n\n`;
              return feedback;
            })
            .join("");

          // Add tool results as a user message
          const userMessage: CoreMessage = {
            role: "user",
            content: formattedResults,
          };

          messages.push(userMessage);
        }
      } else if (result.text) {
        // Add the assistant's text response to messages (no tool calls)
        messages.push({
          role: "assistant",
          content: result.text,
        });

        // Try to parse the final JSON output
        try {
          const possibleJson = JSON.parse(result.text);
          if (
            possibleJson.siteDescription &&
            Array.isArray(possibleJson.journey) &&
            Array.isArray(possibleJson.stepsSummary) &&
            possibleJson.finalUrl
          ) {
            console.log("Found final JSON output");
            finalOutput = possibleJson;
            isDone = true;
          }
        } catch (e) {
          // Not valid JSON, continue the conversation
          console.log("Response is not final JSON output, continuing...");
        }
      }

      // Check if we should stop based on finishReason
      if (result.finishReason) {
        // Check if finishReason is a string or an object with a type property
        const reason =
          typeof result.finishReason === "string"
            ? result.finishReason
            : (result.finishReason as any).type || result.finishReason;

        if (reason === "stop") {
          console.log("Detected finish reason 'stop', ending conversation loop");
          isDone = true;
        }
      }

      // Log current iteration details
      console.log(
        `Iteration ${iteration} completed. Tool calls: ${result.toolCalls?.length || 0}, Has text: ${!!result.text}`,
      );
    }

    // Consolidate the step results into the format expected by the rest of the code
    fullLog.rawResult = {
      text: finalOutput ? JSON.stringify(finalOutput) : "",
      steps: allSteps,
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      experimental_output: finalOutput,
      reasoning: "Manually accumulated through multiple steps",
      finishReason: { type: "stop", reason: "Conversation completed" },
    };

    // Destructure the properties we need for logging and return
    const { text, reasoning, sources, finishReason, usage } = fullLog.rawResult;

    // Log additional information
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
  allSteps.forEach((step, i) => {
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

  // Get the final structured output
  const output = fullLog.rawResult.experimental_output;

  // Log the raw output for debugging
  console.log(
    "generateText returned (raw):",
    JSON.stringify(
      {
        text: fullLog.rawResult.text,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
        output,
      },
      null,
      2,
    ),
  );

  // Add structured outputs to log collection
  fullLog.structuredOutput = {
    text: fullLog.rawResult.text,
    toolCalls: allToolCalls,
    toolResults: allToolResults,
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

  // Return all the required data
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
