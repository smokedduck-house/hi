import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subject, seconds, startTime, endTime } = await req.json() as {
    subject: string;
    seconds: number;
    startTime?: string;
    endTime?: string;
  };
  const log = await prisma.studyLog.update({
    where: { id },
    data: { subject, seconds, startTime: startTime ?? null, endTime: endTime ?? null },
  });
  return NextResponse.json(log);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.studyLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
