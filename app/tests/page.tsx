"use client";

import { BeakerIcon } from "@heroicons/react/24/solid";
import { TestsAddButton } from "./TestsAddButton";
import TestsTable from "./TestsTable";

const Page = () => {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">
            <BeakerIcon className="inline size-7" /> Tests
          </h1>
          <p>View all your previously ran tests here.</p>
        </div>
        <div>
          <TestsAddButton />
        </div>
      </div>

      <div className="mt-3">
        <TestsTable />
      </div>
    </div>
  );
};

export default Page;
