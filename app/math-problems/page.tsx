import { prisma } from "@/lib/prisma";
import { MathProblemsClient } from "@/components/math-problems-client";

export const dynamic = "force-dynamic";

export default async function MathProblemsPage() {
  const problems = await prisma.mathProblem.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, unit: true, memo: true, aiNote: true, mimeType: true, createdAt: true },
  });

  return (
    <MathProblemsClient
      initialProblems={problems.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
    />
  );
}
