import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExamDetailClient } from "@/components/exam-detail-client";

export const dynamic = "force-dynamic";

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      subjects: {
        include: { questions: { orderBy: { number: "asc" } } },
      },
    },
  });

  if (!exam) notFound();

  return (
    <ExamDetailClient
      exam={{
        id: exam.id,
        name: exam.name,
        date: exam.date.toISOString(),
        type: exam.type,
        subjects: exam.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          optionName: s.optionName,
          rawScore: s.rawScore,
          standardScore: s.standardScore,
          percentile: s.percentile,
          grade: s.grade,
          maxRawScore: s.maxRawScore,
          questions: s.questions.map((q) => ({
            id: q.id,
            number: q.number,
            unit: q.unit,
            topic: q.topic ?? "",
            isCorrect: q.isCorrect,
            wrongType: q.wrongType,
            memo: q.memo,
          })),
        })),
      }}
    />
  );
}
