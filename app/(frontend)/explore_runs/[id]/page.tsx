"use server";

import ArrowLeftIcon from "@heroicons/react/24/solid/ArrowLeftIcon";
import Link from "next/link";
import ExploreRunDetail from "./explore-run-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) return <div>error: no id specified</div>;

  return (
    <div>
      <div className="mb-4">
        <Link href="/explore_runs" className="flex items-center text-slate-600 hover:text-slate-800">
          <ArrowLeftIcon className="mr-1 inline size-5" />
          Back to Test Generation History
        </Link>
      </div>

      <ExploreRunDetail id={id} />
    </div>
  );
}
