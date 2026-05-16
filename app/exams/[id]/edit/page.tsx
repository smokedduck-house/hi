import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExamNewClient } from "@/components/exam-new-client";

export const dynamic = "force-dynamic";

export default async function ExamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [exam, units] = await Promise.all([
    prisma.exam.findUnique({
      where: { id },
      include: { subjects: { include: { questions: true } } },
    }),
    prisma.unit.findMany({ orderBy: [{ subjectName: "asc" }, { order: "asc" }] }),
  ]);

  if (!exam) notFound();

  return (
    <ExamNewClient
      units={units}
      initialExam={{
        ...exam,
        date: exam.date.toISOString(),
        subjects: exam.subjects.map((s) => ({
          ...s,
          questions: s.questions.map((q) => ({
            number: q.number,
            unit: q.unit,
            isCorrect: q.isCorrect,
            wrongType: q.wrongType,
            memo: q.memo,
          })),
        })),
      }}
    />
  );
}
