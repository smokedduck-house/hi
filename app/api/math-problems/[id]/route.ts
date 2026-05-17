import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = await prisma.mathProblem.findUnique({ where: { id } });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(problem);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, source, unit, problem: problemText, aiNote, memo } = await req.json();
  const problem = await prisma.mathProblem.update({
    where: { id },
    data: { title: title ?? "", source: source ?? "", unit: unit ?? "", problem: problemText ?? "", aiNote: aiNote ?? "", memo: memo ?? "" },
  });
  return NextResponse.json(problem);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.mathProblem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
