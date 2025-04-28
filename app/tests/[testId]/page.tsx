"use server";

import ArrowLeftIcon from "@heroicons/react/24/solid/ArrowLeftIcon";
import Link from "next/link";
import TestView from "./TestView";

export default async function Page({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;

  if (!testId) return <div>error: no testId specified</div>;

  return (
    <div>
      <div className="mb-4">
        <Link href="/tests" className="flex items-center text-slate-600 hover:text-slate-800">
          <ArrowLeftIcon className="mr-1 inline size-5" />
          Back to Tests
        </Link>
      </div>

      <TestView testId={testId} />
    </div>
  );
}
