import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vercel Cron이 호출 → 오늘의 활성 플랜 정보를 갱신·반환
export async function GET(req: NextRequest) {
  // Vercel cron 요청 검증 (Authorization: Bearer <CRON_SECRET>)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // 오늘이 범위 안에 있는 활성 플랜 조회
  const activePlans = await prisma.studyPlan.findMany({
    where: { startDate: { lte: today }, endDate: { gte: today } },
    select: { id: true, title: true, tasks: true, schedule: true },
  });

  const summaries = activePlans.map((plan) => {
    const schedule: Record<string, Record<string, number>> = JSON.parse(plan.schedule || "{}");
    const todaySchedule = schedule[today] ?? {};
    const tasks: { name: string; totalCount: number; unit: string }[] = JSON.parse(plan.tasks || "[]");

    const todayItems = Object.entries(todaySchedule)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => {
        const task = tasks.find((t) => t.name === name);
        return { name, count, unit: task?.unit ?? "" };
      });

    const totalToday = todayItems.reduce((s, t) => s + t.count, 0);

    return {
      planId: plan.id,
      title: plan.title,
      date: today,
      todayItems,
      totalToday,
    };
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    date: today,
    activePlans: summaries.length,
    plans: summaries,
  });
}
