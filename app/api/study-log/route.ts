import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date 파라미터 필요" }, { status: 400 });

  const logs = await prisma.studyLog.findMany({
    where: { date },
    orderBy: { createdAt: "asc" },
  });

  const bySubject: Record<string, number> = {};
  let totalSeconds = 0;
  for (const log of logs) {
    bySubject[log.subject] = (bySubject[log.subject] ?? 0) + log.seconds;
    totalSeconds += log.seconds;
  }

  return NextResponse.json({ logs, bySubject, totalSeconds });
}

export async function POST(req: NextRequest) {
  const { planId, date, subject, seconds, startTime, endTime } = await req.json() as {
    planId?: string;
    date: string;
    subject: string;
    seconds: number;
    startTime?: string;
    endTime?: string;
  };

  if (!date || !subject || !seconds) return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });

  const log = await prisma.studyLog.create({
    data: { planId: planId ?? null, date, subject, seconds, startTime: startTime ?? null, endTime: endTime ?? null },
  });
  return NextResponse.json(log, { status: 201 });
}
