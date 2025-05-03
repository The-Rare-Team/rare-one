import { runAIAgent } from "@/lib/ai-agent";
import { prisma } from "@/utils/db";
import { NextRequest, NextResponse } from "next/server";

export const POST = async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  console.log("Running test with ID:", id);

  try {
    const exploreRun = await prisma.exploreRun.update({
      where: {
        id,
        status: "pending",
      },
      data: {
        status: "running",
      },
    });

    const result = await runAIAgent(exploreRun!);

    await prisma.exploreRun.update({
      where: {
        id,
        status: "running",
      },
      data: {
        status: "complete",
        siteDescription: result.siteDescription,
        stepsSummary: result.stepsSummary,
        steps: result.journey,
      },
    });

    return NextResponse.json({ text: result }, { status: 200 });
  } catch (error) {
    await prisma.exploreRun.update({
      where: {
        id,
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
