import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [recentExams, wrongQuestions, wrongTypesRaw, trendSubjectsRaw] =
    await Promise.all([
      prisma.exam.findMany({
        take: 3,
        orderBy: { date: "desc" },
        include: { subjects: { include: { questions: true } } },
      }),
      prisma.question.findMany({
        where: { isCorrect: false },
        select: { unit: true },
      }),
      prisma.question.groupBy({
        by: ["wrongType"],
        where: { isCorrect: false, wrongType: { not: null } },
        _count: { wrongType: true },
      }),
      prisma.subject.findMany({
        take: 60,
        orderBy: { exam: { date: "desc" } },
        include: { exam: { select: { date: true, name: true } } },
        where: { grade: { not: null } },
      }),
    ]);

  const unitCount: Record<string, number> = {};
  for (const q of wrongQuestions) {
    unitCount[q.unit] = (unitCount[q.unit] ?? 0) + 1;
  }
  const topWrongUnits = Object.entries(unitCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([unit, count]) => ({ unit, count }));

  const wrongTypeDistribution = wrongTypesRaw.map((w) => ({
    type: w.wrongType ?? "미분류",
    count: w._count.wrongType,
  }));

  return (
    <DashboardClient
      recentExams={recentExams}
      topWrongUnits={topWrongUnits}
      wrongTypeDistribution={wrongTypeDistribution}
      trendSubjects={trendSubjectsRaw}
    />
  );
}
