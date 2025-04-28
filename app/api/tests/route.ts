import { NextRequest, NextResponse } from "next/server";

// export const GET = async function GET(req: NextRequest, { params }: { params: { orgId: string, classId: string } }) {

//     const orgId = (await params).orgId;

//     return NextResponse.json({ message: "ERROR" }, { status: 500 });
// };

export const GET = async function GET(req: NextRequest) {

    const data_mock = [
        {
            id: "cma0etdlm00000cl1hqqxh0m5",
            name: "Test 1",
            url: "https://example.com/test1",
            description: "This is a test of the main user journey.",
            status: "Passed",
            createdAt: new Date().toISOString(),
        },
        {
            id: "cma0etkx200050cl1dekift3n",
            name: "Test 2",
            url: "https://example.com/test2",
            description: "This is another test of a secondary user journey.",
            status: "Failed",
            createdAt: new Date().toISOString(),
        }
    ];

    return NextResponse.json(data_mock, { status: 200 });

};

export const POST = async function POST(req: NextRequest) {

    const data = await req.json();

    console.log("POST data", data);

    return NextResponse.json({ message: "OK" }, { status: 200 }); // TODO return the created test object + all test objects to optimistiacally update the list of tests on FE.

};