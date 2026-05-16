import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subjectName = searchParams.get("subject");
  const optionName = searchParams.get("option");

  const units = await prisma.unit.findMany({
    where: {
      ...(subjectName ? { subjectName } : {}),
      ...(optionName !== null ? { optionName: optionName || null } : {}),
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(units);
}
