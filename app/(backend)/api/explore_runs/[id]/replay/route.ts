import { getReplay } from "@/lib/browser-manager";
import { prisma } from "@/utils/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const test = await prisma.exploreRun.findUnique({
      where: {
        id: id,
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
