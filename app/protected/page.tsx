"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { submitUrl, launchBrowser, startBrowserSession } from "@/app/actions";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:bg-blue-400"
    >
      {pending ? "Submitting..." : "Submit"}
    </button>
  );
}

export default function ProtectedPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [liveViewLink, setLiveViewLink] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/sign-in");
        return;
      }

      setUser(data.user);
      setLoading(false);
    }

    getUser();
  }, [router]);

  async function handleFormAction(formData: FormData) {
    try {
      // Clear any previous messages
      setMessage(null);

      // Call the server action
      const result = await submitUrl(formData);

      if (result.success) {
        setMessage({ type: "success", text: result.message });
        // Reset the form
        const form = document.getElementById("urlForm") as HTMLFormElement;
        if (form) form.reset();
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    }
  }

  async function handleLaunchBrowser() {
    try {
      // Clear any previous messages
      setMessage(null);

      // Call the server action
      const { session, liveViewLink } = await startBrowserSession();
      setLiveViewLink(liveViewLink);

      const result = await launchBrowser(session.id, session.connectUrl);

      if (result.success) {
        setMessage({ type: "success", text: result.message });
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid min-h-[90vh] w-full grid-cols-12 gap-6">
      {/* Left column - Forms */}
      <div className="col-span-4">
        {message && (
          <div
            className={`mb-4 rounded p-3 ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {message.text}
          </div>
        )}

        <form id="urlForm" action={handleFormAction} className="mb-6 w-full">
          <div className="mb-4">
            <label htmlFor="url" className="mb-2 block text-sm font-medium">
              Enter URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
              placeholder="https://example.com"
              required
            />
          </div>
          <SubmitButton />
        </form>

        <div className="w-full">
          <button
            onClick={handleLaunchBrowser}
            className="w-full rounded bg-purple-600 p-2 text-white hover:bg-purple-700"
          >
            Launch Browser
          </button>
        </div>
      </div>

      {/* Right column - Browser View */}
      <div className="col-span-8">
        {liveViewLink ? (
          <iframe
            src={liveViewLink}
            sandbox="allow-same-origin allow-scripts"
            allow="clipboard-read; clipboard-write"
            style={{ pointerEvents: "none", width: "100%", height: "100%", minHeight: "700px" }}
            className="rounded-lg"
          />
        ) : (
          <div className="p-6 text-center">
            <h3 className="text-lg font-medium">Browser View</h3>
            <p className="text-zinc-500 dark:text-zinc-400">
              Live browser view will appear here after launching
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
