import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subjectName = searchParams.get("subject");
  const unit = searchParams.get("unit");
  const wrongType = searchParams.get("wrongType");
  const bookmarked = searchParams.get("bookmarked");
  const search = searchParams.get("search");

  const questions = await prisma.question.findMany({
    where: {
      isCorrect: false,
      ...(unit ? { unit } : {}),
      ...(wrongType ? { wrongType } : {}),
      ...(bookmarked === "true" ? { isBookmarked: true } : {}),
      ...(search ? { OR: [{ unit: { contains: search } }, { memo: { contains: search } }, { topic: { contains: search } }] } : {}),
      subject: {
        ...(subjectName ? { name: subjectName } : {}),
      },
    },
    include: {
      subject: {
        include: { exam: { select: { name: true, date: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(questions);
}

export async function PATCH(req: NextRequest) {
  const { id, isBookmarked, memo } = await req.json() as {
    id: string;
    isBookmarked?: boolean;
    memo?: string;
  };

  const updated = await prisma.question.update({
    where: { id },
    data: {
      ...(isBookmarked !== undefined ? { isBookmarked } : {}),
      ...(memo !== undefined ? { memo } : {}),
    },
  });

  return NextResponse.json(updated);
}
