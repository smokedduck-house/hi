import { prisma } from "@/lib/prisma";
import { TrendsClient } from "@/components/trends-client";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const subjects = await prisma.subject.findMany({
    include: { exam: { select: { name: true, date: true } } },
    orderBy: { exam: { date: "asc" } },
  });
  return <TrendsClient subjects={subjects} />;
}
