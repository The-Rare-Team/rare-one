"use server";

import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", "Email and password are required");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error(error.code + " " + error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  } else {
    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link.",
    );
  }
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/protected");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect("error", "/forgot-password", "Could not reset password");
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect("success", "/forgot-password", "Check your email for a link to reset your password.");
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect("error", "/protected/reset-password", "Password and confirm password are required");
  }

  if (password !== confirmPassword) {
    encodedRedirect("error", "/protected/reset-password", "Passwords do not match");
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect("error", "/protected/reset-password", "Password update failed");
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

/**
 * Server action to process a submitted URL
 */
export async function submitUrl(formData: FormData) {
  const url = formData.get("url") as string;

  if (!url) {
    return { success: false, message: "URL is required" };
  }

  try {
    // Log the URL
    console.log("Received URL for analysis:", url);

    // Call our API endpoint to analyze the URL
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/analyze-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Failed to analyze URL: ${response.statusText}`);
    }

    // For streaming responses, we return a success status
    // The actual content will be handled by the client component
    return {
      success: true,
      message: "URL analysis initiated",
      url: url, // Return the URL for reference on the client side
    };
  } catch (error) {
    console.error("Error in submitUrl action:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to process URL",
    };
  }
}

/**
 * Server action to launch a browser
 */
export async function launchBrowser(sessionId: string, connectUrl: string) {
  // This is just a placeholder
  console.log("Browser launch requested");

  await _launchBrowser(sessionId, connectUrl);

  return {
    success: true,
    message: "Browser launch requested",
  };
}

export async function startBrowserSession() {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID! });
  const liveViewLinks = await bb.sessions.debug(session.id);
  const liveViewLink = liveViewLinks.debuggerFullscreenUrl;
  console.log(`🔍 Live View Link: ${liveViewLink}`);

  return { session, liveViewLink };
}

async function _launchBrowser(sessionId: string, connectUrl: string) {
  // Connect to the session
  const browser = await chromium.connectOverCDP(connectUrl);

  // Getting the default context to ensure the sessions are recorded.
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  await page.goto("https://news.ycombinator.com/");
  await page.waitForTimeout(5000);
  await page.close();
  await browser.close();
  console.log(`Session complete! View replay at https://browserbase.com/sessions/${sessionId}`);
}
