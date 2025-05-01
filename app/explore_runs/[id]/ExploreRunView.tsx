"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetcher } from "@/utils/api";
import { useEffect, useRef } from "react";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";
import useSWR, { mutate } from "swr";
import useSWRMutation from "swr/mutation";

const ExploreRunView = ({ id }: { id: string }) => {
  const {
    data: exploreRun,
    error,
    isLoading,
  } = useSWR(`/api/explore_runs/${id}`, fetcher, {
    refreshInterval: (exploreRun) => {
      if (!exploreRun) return 1000; // If no data yet, don't refresh
      return exploreRun.status === "pending" ? 1000 : 6000; // 5s if pending, otherwise no refresh
    },
  });
  const {
    data: replayData,
    trigger,
    isMutating: isLoadingReplay,
  } = useSWRMutation(`/api/explore_runs/${id}/replay`, fetcher);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (playerRef.current && replayData.length > 0) {
      // Initialize the player with your session recording
      new rrwebPlayer({
        target: playerRef.current,
        props: {
          events: replayData,
          width: 1024,
          height: 576,
        },
      });
    }
  }, [replayData, playerRef]);

  // start test if test is pending
  useEffect(() => {
    if (!exploreRun) return;
    if (exploreRun.status == "pending") {
      startExploreRun();
      mutate(`/api/explore_runs/${id}`); // force revalidation of the test data
    }
  }, [exploreRun]);

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;
  if (!exploreRun) return <div>test not found</div>;

  const startExploreRun = async () => {
    console.log("Starting explore_run...");
    const res = await fetch(`/api/explore_runs/${id}/run`, {
      method: "POST",
    });

    if (!res.ok) {
      const error = new Error("An error occurred while submitting the data.") as Error & {
        info?: any;
        status?: number;
      };
      error.info = await res.json();
      error.status = res.status;
      throw error;
    } else {
      return res.json();
    }
  };

  const loadReplay = async () => {
    console.log("Loading session replay...");
    await trigger();
  };

  // render data
  return (
    <div>
      <div className="mb-4 rounded border hover:bg-gray-50">
        {exploreRun.status == "pending" && (
          <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-gray-300"></div>
        )}

        {exploreRun.status == "running" && (
          <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-gray-300">
            <div className="animate-indeterminate1 absolute top-0 left-0 h-full bg-orange-500" />
            <div className="animate-indeterminate2 absolute top-0 left-0 h-full bg-orange-500" />
          </div>
        )}

        {exploreRun.status == "complete" && (
          <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-green-700"></div>
        )}

        {exploreRun.status == "error" && (
          <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-red-700"></div>
        )}

        <div className="mb-2 p-3">
          <div className="mb-1 flex items-center gap-x-2">
            <h2 className="text-xl font-bold">{exploreRun.name}</h2>

            {exploreRun.status == "pending" && (
              <Badge variant="default" className="bg-gray-600 text-xs hover:bg-gray-700">
                Pending
              </Badge>
            )}

            {exploreRun.status == "running" && (
              <Badge variant="default" className="bg-orange-600 text-xs hover:bg-orange-700">
                In Progress
              </Badge>
            )}

            {/* {test.status == "complete" && (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">Complete</Badge>
                                )} */}

            {exploreRun.status == "error" && (
              <Badge variant="default" className="bg-red-600 text-xs hover:bg-red-700">
                Error
              </Badge>
            )}
          </div>

          <p className="pb-2 text-slate-500">{exploreRun.description}</p>
          <p className="pb-2 text-slate-500">{exploreRun.siteDescription}</p>
          <div className="grid grid-cols-2 gap-x-2">
            <div>
              <p>
                <span className="text-slate-600">Base URL:</span>{" "}
                <span className="font-medium text-slate-900">{exploreRun.url}</span>
              </p>
            </div>
            <div>
              <p>
                <span className="text-slate-600">Created at:</span>{" "}
                <span className="font-medium text-slate-900">{new Date(exploreRun.createdAt).toLocaleString()}</span>
              </p>
            </div>
            <div>
              <p>
                <span className="text-slate-600">Updated at:</span>{" "}
                <span className="font-medium text-slate-900">{new Date(exploreRun.updatedAt).toLocaleString()}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      <div>
        {exploreRun.status == "running" && exploreRun.liveViewUrl && (
          <iframe
            src={exploreRun.liveViewUrl}
            sandbox="allow-same-origin allow-scripts"
            allow="clipboard-read; clipboard-write"
            style={{ pointerEvents: "none", width: "100%", height: "100%", minHeight: "700px" }}
            className="rounded-lg"
          />
        )}

        {exploreRun.status == "pending" && (
          <div className="p-6 text-center">
            <h3 className="text-lg font-medium">Browser View</h3>
            <p className="text-zinc-500 dark:text-zinc-400">Live browser view will appear here after launching</p>
            {exploreRun.status == "pending" && (
              <Button
                variant="default"
                onClick={() => startExploreRun()}
                className="mt-3 bg-blue-700 hover:bg-blue-800"
              >
                Run Generation
              </Button>
            )}
          </div>
        )}

        {exploreRun.status == "complete" && (
          <Tabs defaultValue="steps" className="w-full">
            <TabsList>
              <TabsTrigger value="steps">Steps</TabsTrigger>
              <TabsTrigger value="replay">Replay</TabsTrigger>
            </TabsList>
            <TabsContent value="replay" className="p-6 text-center">
              {!replayData && (
                <div>
                  <h3 className="text-lg font-medium">Generation Complete</h3>
                  <p className="text-zinc-500 dark:text-zinc-400">You can now view the replay here.</p>
                  <Button
                    disabled={isLoadingReplay}
                    variant="default"
                    onClick={() => loadReplay()}
                    className="mt-3 bg-green-700 hover:bg-green-800"
                  >
                    {isLoadingReplay && <Loader2 className="animate-spin" />}
                    Load Replay
                  </Button>
                </div>
              )}

              {replayData && (
                <div>
                  <div ref={playerRef} />
                </div>
              )}
            </TabsContent>
            <TabsContent value="steps" className="p-6">
              {exploreRun.stepsSummary.map((step: any, index: number) => (
                <div key={index}>
                  <p>{step}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default ExploreRunView;
