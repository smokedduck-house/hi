import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const { date, subject, done } = await req.json() as { date: string; subject: string; done: number };

  const completion = await prisma.taskCompletion.upsert({
    where: { planId_date_subject: { planId, date, subject } },
    update: { done },
    create: { planId, date, subject, done },
  });

  return NextResponse.json(completion);
}
