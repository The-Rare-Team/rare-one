"use client";

import { BeakerIcon } from "@heroicons/react/24/solid";
import { NewExploreRunButton } from "./NewExploreRunButton";
import ExploreRunTable from "./ExploreRunTable";

const Page = () => {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">
            <BeakerIcon className="inline size-7" /> Test Generation History
          </h1>
          <p>View all your previously test generation here.</p>
        </div>
        <div>
          <NewExploreRunButton />
        </div>
      </div>

      <div className="mt-3">
        <ExploreRunTable />
      </div>
    </div>
  );
};

export default Page;
