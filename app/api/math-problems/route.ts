import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const problems = await prisma.mathProblem.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, unit: true, memo: true, aiNote: true, mimeType: true, createdAt: true },
  });
  return NextResponse.json(problems);
}

export async function POST(req: NextRequest) {
  const { title, imageData, mimeType, unit, memo, aiNote } = await req.json();
  if (!imageData) return NextResponse.json({ error: "imageData 필요" }, { status: 400 });

  const problem = await prisma.mathProblem.create({
    data: { title: title ?? "", imageData, mimeType: mimeType ?? "image/jpeg", unit: unit ?? "", memo: memo ?? "", aiNote: aiNote ?? "" },
  });
  return NextResponse.json(problem, { status: 201 });
}
