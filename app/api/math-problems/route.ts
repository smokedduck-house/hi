import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const problems = await prisma.mathProblem.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, source: true, unit: true, problem: true, aiNote: true, memo: true, mimeType: true, category: true, createdAt: true },
  });
  return NextResponse.json(problems);
}

export async function POST(req: NextRequest) {
  const { title, source, unit, problem: problemText, imageData, mimeType, aiNote, memo, category } = await req.json();
  const problem = await prisma.mathProblem.create({
    data: {
      title: title ?? "",
      source: source ?? "",
      unit: unit ?? "",
      problem: problemText ?? "",
      imageData: imageData ?? "",
      mimeType: mimeType ?? "image/jpeg",
      aiNote: aiNote ?? "",
      memo: memo ?? "",
      category: category ?? "오답",
    },
  });
  return NextResponse.json(problem, { status: 201 });
}
