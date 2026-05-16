import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const exams = await prisma.exam.findMany({
    orderBy: { date: "desc" },
    include: {
      subjects: {
        include: { questions: true },
      },
    },
  });
  return NextResponse.json(exams);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, date, type, grade, subjects } = body as {
    name: string;
    date: string;
    type: string;
    grade: string;
    subjects: Array<{
      name: string;
      optionName?: string;
      rawScore?: number;
      standardScore?: number;
      percentile?: number;
      grade?: number;
      maxRawScore?: number;
      questions: Array<{
        number: number;
        unit: string;
        topic?: string;
        difficulty?: string;
        isCorrect: boolean;
        wrongType?: string;
        memo?: string;
      }>;
    }>;
  };

  const exam = await prisma.exam.create({
    data: {
      name,
      date: new Date(date),
      type,
      grade,
      subjects: {
        create: subjects.map((s) => ({
          name: s.name,
          optionName: s.optionName,
          rawScore: s.rawScore,
          standardScore: s.standardScore,
          percentile: s.percentile,
          grade: s.grade,
          maxRawScore: s.maxRawScore ?? 100,
          questions: {
            create: s.questions.map((q) => ({
              number: q.number,
              unit: q.unit,
              topic: q.topic,
              difficulty: q.difficulty ?? "중",
              isCorrect: q.isCorrect,
              wrongType: q.wrongType,
              memo: q.memo,
            })),
          },
        })),
      },
    },
    include: { subjects: { include: { questions: true } } },
  });

  return NextResponse.json(exam, { status: 201 });
}
