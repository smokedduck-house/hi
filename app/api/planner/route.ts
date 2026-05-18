import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSchedule, dateRange } from "@/lib/planner-utils";
import type { PlannerTask, PlanConfig } from "@/lib/planner-utils";

export async function GET() {
  const plans = await prisma.studyPlan.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, startDate: true, endDate: true, tasks: true, createdAt: true },
  });
  return NextResponse.json(plans);
}

// 플랜 프레임 생성 (할 일 없이 제목+날짜만)
export async function POST(req: NextRequest) {
  const { title, startDate, endDate, dailyMinutes, restDays } = await req.json() as {
    title: string;
    startDate: string;
    endDate: string;
    dailyMinutes?: number;
    restDays?: string[];
  };

  if (!title?.trim() || !startDate || !endDate || endDate <= startDate)
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });

  const dates = dateRange(startDate, endDate);
  if (dates.length === 0) return NextResponse.json({ error: "날짜 범위 오류" }, { status: 400 });

  const config: PlanConfig = {
    dailyMinutes: dailyMinutes ?? 240,
    restDays: restDays ?? ["일"],
  };

  const emptyTasks: PlannerTask[] = [];
  const emptySchedule = buildSchedule(dates, emptyTasks, config);

  const plan = await prisma.studyPlan.create({
    data: {
      title: title.trim(),
      startDate,
      endDate,
      tasks: JSON.stringify(emptyTasks),
      schedule: JSON.stringify(emptySchedule),
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
