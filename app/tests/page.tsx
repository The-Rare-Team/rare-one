"use client";

import TestsTable from "./TestsTable";

const Page = () => {


  return (
    <div>
      <h1 className="text-2xl font-medium">Tests</h1>
      <p>View all your previously ran tests here.</p>
      <div className="mt-3">
        <TestsTable />
      </div>
    </div>
  )
}

export default Page;