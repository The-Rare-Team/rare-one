import { prisma } from "@/utils/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;

  try {
    const test = await prisma.test.findUnique({
      where: {
        id: testId,
      },
    });

    return NextResponse.json(test, { status: 200 });
  } catch (error) {
    console.error("Database prisma error:", error);
    return NextResponse.json({ message: "ERROR" }, { status: 500 });
  }
}

export const POST = async function POST(req: NextRequest) {
  const data = await req.json();

  //await new Promise(r => setTimeout(r, 5000)); // simulate a delay

  try {
    const tests = await prisma.test.create({
      data: {
        name: data.name,
        url: data.url || undefined,
        description: data.description || undefined,
        status: data.statu || undefined,
      },
    });

    // TODO Ahmed/Roy call the test runner to run the test immediately after creating it.

    return NextResponse.json(tests, { status: 200 });
  } catch (error) {
    console.error("Database prisma error:", error);
    return NextResponse.json({ message: "ERROR" }, { status: 500 });
  }
};
