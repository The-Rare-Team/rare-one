import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetcher } from "@/utils/api"
import Link from "next/link"
import useSWR from "swr"

const TestsTable = () => {

    const { data, error, isLoading } = useSWR(`/api/tests`, fetcher)

    if (error) return <div>failed to load</div>
    if (isLoading) return <div>loading...</div>

    // render data
    return (
        <div>
            {data.map((test: any) => (
                <div key={test.id} className="border mb-4 hover:bg-gray-50 rounded">

                    {test.status == "pending" && (
                        <div className="relative w-full h-1.5 overflow-hidden rounded-t bg-gray-300 mb-1">
                            <div className="absolute top-0 left-0 h-full bg-orange-500 animate-indeterminate1" />
                            <div className="absolute top-0 left-0 h-full bg-orange-500 animate-indeterminate2" />
                        </div>
                    )}

                    {test.status == "complete" && (
                        <div className="relative w-full h-1.5 overflow-hidden rounded-t bg-green-700 mb-1"></div>
                    )}

                    {test.status == "error" && (
                        <div className="relative w-full h-1.5 overflow-hidden rounded-t bg-red-700 mb-1"></div>
                    )}

                    <div className="flex mb-2 p-3">
                        <div>
                            <div className="mb-1 flex items-center gap-x-2">
                                <h2 className="text-xl font-bold">{test.name}</h2>

                                {test.status == "pending" && (
                                    <Badge variant="default" className="bg-orange-600 hover:bg-orange-700 text-xs">In Progress</Badge>
                                )}

                                {/* {test.status == "complete" && (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">Complete</Badge>
                                )} */}

                                {test.status == "error" && (
                                    <Badge variant="default" className="bg-red-600 hover:bg-red-700 text-xs">Error</Badge>
                                )}

                            </div>


                            <p className="pb-2 text-slate-500">{test.description}</p>
                            <p><span className="text-slate-600">Base URL:</span> <span className="text-slate-900 font-medium">{test.url}</span></p>
                            <p><span className="text-slate-600">Created at:</span> <span className="text-slate-900 font-medium">{new Date(test.createdAt).toLocaleString()}</span></p>
                        </div>
                        <div className="ml-auto">
                            <Link href={`/tests/${test.id}`}><Button>View Details</Button></Link>
                        </div>
                    </div>

                </div>
            ))}
            {data.length === 0 && <p>No tests found.</p>}
        </div>
    )
}

export default TestsTable;