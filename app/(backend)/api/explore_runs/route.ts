import { prisma } from "@/utils/db";
import { NextRequest, NextResponse } from "next/server";
import { startSession } from "@/lib/browser-manager";
// export const GET = async function GET(req: NextRequest, { params }: { params: { orgId: string, classId: string } }) {

//     const orgId = (await params).orgId;

//     return NextResponse.json({ message: "ERROR" }, { status: 500 });
// };

export const GET = async function GET(req: NextRequest) {
  // const data_mock = [
  //     {
  //         id: "cma0etdlm00000cl1hqqxh0m5",
  //         name: "Test 1",
  //         url: "https://example.com/test1",
  //         description: "This is a test of the main user journey.",
  //         status: "Passed",
  //         createdAt: new Date().toISOString(),
  //     },
  //     {
  //         id: "cma0etkx200050cl1dekift3n",
  //         name: "Test 2",
  //         url: "https://example.com/test2",
  //         description: "This is another test of a secondary user journey.",
  //         status: "Failed",
  //         createdAt: new Date().toISOString(),
  //     }
  // ];
  //return NextResponse.json(data_mock, { status: 200 });

  try {
    const tests = await prisma.exploreRun.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(tests, { status: 200 });
  } catch (error) {
    console.error("Database prisma error:", error);
    return NextResponse.json({ message: "ERROR" }, { status: 500 });
  }
};

export const POST = async function POST(req: NextRequest) {
  const data = await req.json();

  //await new Promise(r => setTimeout(r, 5000)); // simulate a delay

  try {
    let session;
    if (process.env.BROWSER_MODE != "local") {
      session = await startSession();
    }
    const tests = await prisma.exploreRun.create({
      data: {
        name: data.name,
        url: data.url || undefined,
        description: data.description || undefined,
        status: data.status || undefined,
        liveViewUrl: session?.liveViewLink || undefined,
        sessionId: session?.sessionId || undefined,
        cdpEndpoint: session?.cdpEndpoint || undefined,
      },
    });

    return NextResponse.json(tests, { status: 200 });
  } catch (error) {
    console.error("Database prisma error:", error);
    return NextResponse.json({ message: "ERROR" }, { status: 500 });
  }
};
