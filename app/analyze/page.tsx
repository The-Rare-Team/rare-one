'use client';

import { useState, useRef, useEffect } from 'react';
import { submitUrl } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AnalyzePage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');
  const analysisRef = useRef<HTMLDivElement>(null);

  // Function to handle URL submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setError('');
    setAnalysis('');

    try {
      const formData = new FormData();
      formData.append('url', url);
      
      const result = await submitUrl(formData);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Start streaming the analysis
      await streamAnalysis(result.url || url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to stream the analysis from the API
  const streamAnalysis = async (urlToAnalyze: string) => {
    try {
      const response = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlToAnalyze }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not available');
      }

      const decoder = new TextDecoder();
      let done = false;
      
      while (!done) {
        const { done: streamDone, value } = await reader.read();
        done = streamDone;
        
        if (value) {
          const text = decoder.decode(value, { stream: !done });
          setAnalysis((prev) => prev + text);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stream analysis');
    }
  };

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (analysisRef.current) {
      analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
    }
  }, [analysis]);

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">URL Analyzer</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
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
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-md mb-4">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      {analysis && (
        <div className="border rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Analysis Result</h2>
          <div 
            ref={analysisRef} 
            className="bg-gray-50 p-4 rounded-md max-h-96 overflow-y-auto whitespace-pre-wrap"
          >
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
} 