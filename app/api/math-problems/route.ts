import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const problems = await prisma.mathProblem.findMany({
    orderBy: { createdAt: "desc" },
    // imageData는 목록에서 제외 (용량)
    select: { id: true, title: true, source: true, unit: true, aiNote: true, memo: true, mimeType: true, createdAt: true },
  });
  return NextResponse.json(problems);
}

export async function POST(req: NextRequest) {
  const { title, source, unit, imageData, mimeType, aiNote, memo } = await req.json();
  const problem = await prisma.mathProblem.create({
    data: {
      title: title ?? "",
      source: source ?? "",
      unit: unit ?? "",
      imageData: imageData ?? "",
      mimeType: mimeType ?? "image/jpeg",
      aiNote: aiNote ?? "",
      memo: memo ?? "",
    },
  });
  return NextResponse.json(problem, { status: 201 });
}
