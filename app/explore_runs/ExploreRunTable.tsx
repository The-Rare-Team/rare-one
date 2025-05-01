import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/utils/api";
import Link from "next/link";
import useSWR from "swr";

const ExploreRunTable = () => {
  const { data, error, isLoading } = useSWR(`/api/explore_runs`, fetcher);

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;

  // render data
  return (
    <div>
      {data.map((exploreRun: any) => (
        <div key={exploreRun.id} className="mb-4 rounded border hover:bg-gray-50">
          {exploreRun.status == "pending" && (
            <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-gray-300"></div>
          )}

          {exploreRun.status == "running" && (
            <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-gray-300">
              <div className="animate-indeterminate1 absolute left-0 top-0 h-full bg-orange-500" />
              <div className="animate-indeterminate2 absolute left-0 top-0 h-full bg-orange-500" />
            </div>
          )}

          {exploreRun.status == "complete" && (
            <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-green-700"></div>
          )}

          {exploreRun.status == "error" && (
            <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-red-700"></div>
          )}

          <div className="mb-2 flex p-3">
            <div>
              <div className="mb-1 flex items-center gap-x-2">
                <h2 className="text-xl font-bold">{exploreRun.name}</h2>

                {exploreRun.status == "pending" && (
                  <Badge variant="default" className="bg-gray-600 text-xs hover:bg-gray-700">
                    Pending
                  </Badge>
                )}

                {exploreRun.status == "running" && (
                  <Badge variant="default" className="bg-orange-600 text-xs hover:bg-orange-700">
                    Generation In Progress
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
              <p>
                <span className="text-slate-600">Base URL:</span>{" "}
                <span className="font-medium text-slate-900">{exploreRun.url}</span>
              </p>
              <p>
                <span className="text-slate-600">Created at:</span>{" "}
                <span className="font-medium text-slate-900">{new Date(exploreRun.createdAt).toLocaleString()}</span>
              </p>
            </div>
            <div className="ml-auto">
              <Link href={`/explore_runs/${exploreRun.id}`}>
                <Button>View Details</Button>
              </Link>
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <p>No tests generation found.</p>}
    </div>
  );
};

export default ExploreRunTable;
