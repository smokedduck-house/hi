import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { subjects: { include: { questions: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(exam);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, date, type, grade, subjects } = body;

  // 기존 subjects 삭제 후 재생성 (cascade로 questions도 삭제됨)
  await prisma.subject.deleteMany({ where: { examId: id } });

  const exam = await prisma.exam.update({
    where: { id },
    data: {
      name,
      date: new Date(date),
      type,
      grade,
      subjects: {
        create: subjects.map((s: {
          name: string; optionName?: string; rawScore?: number; standardScore?: number;
          percentile?: number; grade?: number; maxRawScore?: number; notes?: string;
          questions: { number: number; unit: string; difficulty?: string; isCorrect: boolean; wrongType?: string; memo?: string }[];
        }) => ({
          name: s.name,
          optionName: s.optionName ?? null,
          rawScore: s.rawScore ?? null,
          standardScore: s.standardScore ?? null,
          percentile: s.percentile ?? null,
          grade: s.grade ?? null,
          maxRawScore: s.maxRawScore ?? 100,
          notes: s.notes ?? null,
          questions: {
            create: s.questions.map((q) => ({
              number: q.number,
              unit: q.unit,
              difficulty: q.difficulty ?? "중",
              isCorrect: q.isCorrect,
              wrongType: q.wrongType ?? null,
              memo: q.memo ?? null,
            })),
          },
        })),
      },
    },
    include: { subjects: { include: { questions: true } } },
  });

  return NextResponse.json(exam);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.exam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
