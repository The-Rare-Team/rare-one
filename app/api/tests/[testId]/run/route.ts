import { connectPlaywrightMCP } from "@/lib/browser-manager";
import { Test } from "@/lib/generated/prisma/client";
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

    await runTest(test!);

    return NextResponse.json(test, { status: 200 });
  } catch (error) {
    console.error("Database prisma error:", error);
    return NextResponse.json({ message: "ERROR" }, { status: 500 });
  }
};

async function runTest(test: Test) {
  const { tools, close } = await connectPlaywrightMCP(test.cdpEndpoint!);

  try {
    await tools.browser_navigate.execute(
      {
        url: "https://supabase.com",
      },
      {
        toolCallId: "1",
        messages: [
          {
            role: "user",
            content: "hello",
          },
        ],
      },
    );

    await new Promise((r) => setTimeout(r, 10000));

    await prisma.test.update({
      where: {
        id: test.id,
        status: "running",
      },
      data: {
        status: "complete",
      },
    });
  } catch (error) {
    console.error("Error running test:", error);

    await prisma.test.update({
      where: {
        id: test.id,
        status: "running",
      },
      data: {
        status: "error",
      },
    });
  } finally {
    console.log("Closing browser");
    close();
  }
}
