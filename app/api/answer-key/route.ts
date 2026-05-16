import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 정답지 조회
export async function GET(req: NextRequest) {
  const examId = new URL(req.url).searchParams.get("examId");
  if (!examId) return NextResponse.json([]);

  const keys = await prisma.answerKey.findMany({ where: { examId } });
  return NextResponse.json(keys);
}

// 정답지 저장 (upsert)
export async function POST(req: NextRequest) {
  const { examId, subjectName, optionName, answers, scores, totalCount } = await req.json();

  if (!examId || !subjectName || !answers) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const key = await prisma.answerKey.upsert({
    where: { examId_subjectName_optionName: { examId, subjectName, optionName: optionName ?? null } },
    create: {
      examId, subjectName,
      optionName: optionName ?? null,
      answers: JSON.stringify(answers),
      scores: scores ? JSON.stringify(scores) : null,
      totalCount,
    },
    update: {
      answers: JSON.stringify(answers),
      scores: scores ? JSON.stringify(scores) : null,
      totalCount,
    },
  });

  return NextResponse.json(key);
}
