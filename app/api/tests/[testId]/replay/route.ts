import { getReplay } from "@/lib/browser-manager";
import { prisma } from "@/utils/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;

  try {
    const test = await prisma.test.findUnique({
      where: {
        id: testId,
        status: "complete",
      },
    });

    if (!test || !test.sessionId) {
      return NextResponse.json({ message: "Test not found or not complete" }, { status: 404 });
    }

    const replayData = await getReplay({ sessionId: test.sessionId });
    console.log("Replay data:", replayData);

    return NextResponse.json(replayData, { status: 200 });
  } catch (error) {
    console.error("Database prisma error:", error);
    return NextResponse.json({ message: "ERROR" }, { status: 500 });
  }
}
