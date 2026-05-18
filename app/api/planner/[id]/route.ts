import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSchedule, dateRange } from "@/lib/planner-utils";
import type { PlannerTask } from "@/lib/planner-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await prisma.studyPlan.findUnique({
    where: { id },
    include: { completions: true },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(plan);
}

// 할 일 목록 업데이트 → 스케줄 자동 재생성
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tasks } = await req.json() as { tasks: PlannerTask[] };

  const existing = await prisma.studyPlan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dates = dateRange(existing.startDate, existing.endDate);
  const newSchedule = buildSchedule(dates, tasks);

  const updated = await prisma.studyPlan.update({
    where: { id },
    data: {
      tasks: JSON.stringify(tasks),
      schedule: JSON.stringify(newSchedule),
    },
    include: { completions: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.studyPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
