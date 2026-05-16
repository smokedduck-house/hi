import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const examId = new URL(req.url).searchParams.get("examId");

  const errata = await prisma.errata.findMany({
    where: examId ? { examId } : {},
    include: { exam: { select: { name: true } } },
    orderBy: [{ subjectName: "asc" }, { questionNumber: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(errata);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { examId, subjectName, questionNumber, errataType, before, after, description, isOfficial } = body;

  if (!examId || !errataType || !description) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const item = await prisma.errata.create({
    data: {
      examId,
      subjectName: subjectName || null,
      questionNumber: questionNumber ? Number(questionNumber) : null,
      errataType,
      before: before || null,
      after: after || null,
      description,
      isOfficial: isOfficial ?? false,
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  await prisma.errata.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
