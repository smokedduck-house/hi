import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 최근 3개 시험
  const recentExams = await prisma.exam.findMany({
    take: 3,
    orderBy: { date: "desc" },
    include: {
      subjects: {
        include: { questions: true },
      },
    },
  });

  // 가장 많이 틀린 단원 Top 5
  const wrongQuestions = await prisma.question.findMany({
    where: { isCorrect: false },
    select: { unit: true },
  });
  const unitCount: Record<string, number> = {};
  for (const q of wrongQuestions) {
    unitCount[q.unit] = (unitCount[q.unit] ?? 0) + 1;
  }
  const topWrongUnits = Object.entries(unitCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([unit, count]) => ({ unit, count }));

  // 오답 유형 분포
  const wrongTypes = await prisma.question.groupBy({
    by: ["wrongType"],
    where: { isCorrect: false, wrongType: { not: null } },
    _count: { wrongType: true },
  });
  const wrongTypeDistribution = wrongTypes.map((w) => ({
    type: w.wrongType ?? "미분류",
    count: w._count.wrongType,
  }));

  // 과목별 등급 추이 (최근 6개 시험)
  const trendSubjects = await prisma.subject.findMany({
    take: 60,
    orderBy: { exam: { date: "desc" } },
    include: { exam: { select: { date: true, name: true } } },
    where: { grade: { not: null } },
  });

  return NextResponse.json({
    recentExams,
    topWrongUnits,
    wrongTypeDistribution,
    trendSubjects,
  });
}
