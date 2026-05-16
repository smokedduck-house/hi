import { prisma } from "@/lib/prisma";
import { WrongNotesClient } from "@/components/wrong-notes-client";

export const dynamic = "force-dynamic";

export default async function WrongNotesPage() {
  const [questions, units] = await Promise.all([
    prisma.question.findMany({
      where: { isCorrect: false },
      include: {
        subject: {
          include: { exam: { select: { name: true, date: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.unit.findMany({ orderBy: [{ subjectName: "asc" }, { order: "asc" }] }),
  ]);

  return <WrongNotesClient questions={questions} units={units} />;
}
