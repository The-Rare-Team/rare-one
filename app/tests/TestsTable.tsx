import { fetcher } from "@/utils/api"
import useSWR from "swr"

const TestsTable = () => {

    const { data, error, isLoading } = useSWR(`/api/tests/`, fetcher)

    if (error) return <div>failed to load</div>
    if (isLoading) return <div>loading...</div>

    // render data
    return (
        <div>
            {data.map((test: any) => (
                <div key={test.id} className="border p-4 mb-4">
                    <h2 className="text-xl font-bold">{test.name}</h2>
                    <p>{test.description}</p>
                    <p>Status: {test.status}</p>
                    <p>Created At: {new Date(test.createdAt).toLocaleString()}</p>
                </div>
            ))}
            {data.length === 0 && <p>No tests found.</p>}
        </div>
    )
}

export default TestsTable;