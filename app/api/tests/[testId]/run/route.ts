import { runAIAgent } from "@/lib/ai-agent";
import { prisma } from "@/utils/db";
import { NextRequest, NextResponse } from "next/server";

export const POST = async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;

  console.log("Running test with ID:", testId);

  try {
    const test = await prisma.test.update({
      where: {
        id: testId,
        status: "pending",
      },
      data: {
        status: "running",
      },
    });

    const result = await runAIAgent(test!);

    await prisma.test.update({
      where: {
        id: test.id,
        status: "running",
      },
      data: {
        status: "complete",
      },
    });

    return NextResponse.json({ text: result }, { status: 200 });
  } catch (error) {
    await prisma.test.update({
      where: {
        id: testId,
        status: "running",
      },
      data: {
        status: "error",
      },
    });
    console.error("Database prisma error:", error);
    return NextResponse.json({ message: "ERROR" }, { status: 500 });
  }
};
