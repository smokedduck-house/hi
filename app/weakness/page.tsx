import { prisma } from "@/lib/prisma";
import { WeaknessClient } from "@/components/weakness-client";

export const dynamic = "force-dynamic";

export default async function WeaknessPage() {
  const [questions, subjects] = await Promise.all([
    prisma.question.findMany({
      include: { subject: { select: { name: true, optionName: true } } },
    }),
    prisma.subject.findMany({ select: { name: true, optionName: true } }),
  ]);
  return <WeaknessClient questions={questions} subjects={subjects} />;
}
