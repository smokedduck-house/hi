import { prisma } from "@/lib/prisma";
import { ErrataClient } from "@/components/errata-client";

export const dynamic = "force-dynamic";

export default async function ErrataPage() {
  const exams = await prisma.exam.findMany({
    orderBy: { date: "desc" },
    select: {
      id: true,
      name: true,
      date: true,
      type: true,
      subjects: { select: { name: true, optionName: true } },
    },
  });

  return <ErrataClient exams={exams} />;
}
