"use client";

import { Badge } from "@/components/ui/badge";
import { fetcher } from "@/utils/api";
import useSWR from "swr";

const TestView = ({ testId }: { testId: string }) => {
  const { data: test, error, isLoading } = useSWR(`/api/tests/${testId}`, fetcher);

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;
  if (!test) return <div>test not found</div>;

  // render data
  return (
    <div>
      <div className="mb-4 rounded border hover:bg-gray-50">
        {test.status == "pending" && (
          <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-gray-300">
            <div className="animate-indeterminate1 absolute left-0 top-0 h-full bg-orange-500" />
            <div className="animate-indeterminate2 absolute left-0 top-0 h-full bg-orange-500" />
          </div>
        )}

        {test.status == "complete" && (
          <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-green-700"></div>
        )}

        {test.status == "error" && (
          <div className="relative mb-1 h-1.5 w-full overflow-hidden rounded-t bg-red-700"></div>
        )}

        <div className="mb-2 p-3">
          <div className="mb-1 flex items-center gap-x-2">
            <h2 className="text-xl font-bold">{test.name}</h2>

            {test.status == "pending" && (
              <Badge variant="default" className="bg-orange-600 text-xs hover:bg-orange-700">
                In Progress
              </Badge>
            )}

            {/* {test.status == "complete" && (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">Complete</Badge>
                                )} */}

            {test.status == "error" && (
              <Badge variant="default" className="bg-red-600 text-xs hover:bg-red-700">
                Error
              </Badge>
            )}
          </div>

          <p className="pb-2 text-slate-500">{test.description}</p>
          <div className="grid grid-cols-2 gap-x-2">
            <div>
              <p>
                <span className="text-slate-600">Base URL:</span>{" "}
                <span className="font-medium text-slate-900">{test.url}</span>
              </p>
            </div>
            <div>
              <p>
                <span className="text-slate-600">Created at:</span>{" "}
                <span className="font-medium text-slate-900">{new Date(test.createdAt).toLocaleString()}</span>
              </p>
            </div>
            <div>
              <p>
                <span className="text-slate-600">Updated at:</span>{" "}
                <span className="font-medium text-slate-900">{new Date(test.updatedAt).toLocaleString()}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestView;
