import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const problems = await prisma.mathProblem.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(problems);
}

export async function POST(req: NextRequest) {
  const { title, source, unit, aiNote, memo } = await req.json();
  const problem = await prisma.mathProblem.create({
    data: {
      title: title ?? "",
      source: source ?? "",
      unit: unit ?? "",
      aiNote: aiNote ?? "",
      memo: memo ?? "",
    },
  });
  return NextResponse.json(problem, { status: 201 });
}
