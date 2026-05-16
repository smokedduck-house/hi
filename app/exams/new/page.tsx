import { prisma } from "@/lib/prisma";
import { ExamNewClient } from "@/components/exam-new-client";

export default async function NewExamPage() {
  const units = await prisma.unit.findMany({ orderBy: [{ subjectName: "asc" }, { order: "asc" }] });
  return <ExamNewClient units={units} />;
}
