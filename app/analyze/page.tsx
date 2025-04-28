"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";

export default function AnalyzePage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const analysisRef = useRef<HTMLDivElement>(null);

  // Function to handle URL submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setError("");
    setAnalysis("");

    try {
      await streamAnalysis(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to stream the analysis from the API
  const streamAnalysis = async (urlToAnalyze: string) => {
    const response = await fetch("/api/analyze-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: urlToAnalyze }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    setAnalysis(data.text);
  };

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (analysisRef.current) {
      analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
    }
  }, [analysis]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">URL Analyzer</h1>

      <form onSubmit={handleSubmit} className="mb-6 space-y-4">
        <div className="flex flex-col space-y-2">
          <label htmlFor="url" className="text-sm font-medium">
            Enter URL to analyze
          </label>
          <div className="flex space-x-2">
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="flex-1"
              disabled={isAnalyzing}
            />
            <Button type="submit" disabled={isAnalyzing}>
              {isAnalyzing ? "Analyzing..." : "Analyze"}
            </Button>
          </div>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-500">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      {analysis && (
        <div className="rounded-md border p-4">
          <h2 className="mb-2 text-lg font-semibold">Analysis Result</h2>
          <div ref={analysisRef} className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-4">
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
}
