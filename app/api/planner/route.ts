import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `수능 수험생 학습 플래너 AI.
사용자가 올린 할 일 정보(강의 목록, 교재 범위, 문제집 등)를 분석해서 과제를 파악하고, 날짜별 학습 계획을 JSON으로 생성해.

출력 형식 (순수 JSON만. 코드블록(\`\`\`) 절대 금지):
{
  "tasks": [
    {"name": "과제명", "totalCount": 총수량, "unit": "강/회/쪽/문제 등"}
  ],
  "schedule": {
    "YYYY-MM-DD": {"과제명": 수량},
    ...
  }
}

규칙:
1. tasks[].name은 짧고 명확하게 (예: "뉴런 수2", "국어 기출", "영어 단어장").
2. schedule의 키는 반드시 tasks[].name과 완전히 동일해야 함. 단위·수량 포함 금지.
3. schedule은 시작일부터 종료일까지 모든 날짜 포함.
4. 각 과제 totalCount 합계가 schedule 전체 수량 합계와 정확히 일치해야 함.
5. 일요일: 평일의 50%(0도 허용). 토요일: 평일의 70%.
6. 강의 목록이 주어지면 강 제목을 직접 세서 totalCount 계산.
7. 추가 요청사항 최대한 반영.
8. 수량이 0인 날도 모든 과제 키를 포함.
9. ★중요: tasks[].name은 순수 과제명만. 절대 수량·단위 포함 금지 (예: "뉴런 수2 40강" 금지 → "뉴런 수2" 사용).`;

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export async function GET() {
  const plans = await prisma.studyPlan.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, startDate: true, endDate: true, tasks: true, createdAt: true },
  });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_API_KEY 없음" }, { status: 500 });

  const { title, startDate, endDate, taskInfo, description } = await req.json() as {
    title: string;
    startDate: string;
    endDate: string;
    taskInfo: string;
    description?: string;
  };

  if (!title || !startDate || !endDate || !taskInfo?.trim())
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });

  const dates = dateRange(startDate, endDate);
  if (dates.length === 0) return NextResponse.json({ error: "날짜 범위 오류" }, { status: 400 });

  const userMessage = [
    `시작일: ${startDate}`,
    `종료일: ${endDate}`,
    `총 일수: ${dates.length}일`,
    `\n할 일 목록:\n${taskInfo.trim()}`,
    description ? `\n추가 요청사항:\n${description}` : "",
  ].filter(Boolean).join("\n");

  const ai = new GoogleGenAI({ apiKey });
  let parsed: { tasks: { name: string; totalCount: number; unit: string }[]; schedule: Record<string, Record<string, number>> };

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 8000, temperature: 0.2 },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
    });
    const raw = result.text ?? "";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return NextResponse.json({ error: "AI 일정 생성 실패", detail: String(err) }, { status: 500 });
  }

  if (!parsed.tasks?.length || !parsed.schedule)
    return NextResponse.json({ error: "AI 응답 형식 오류" }, { status: 500 });

  const plan = await prisma.studyPlan.create({
    data: {
      title,
      startDate,
      endDate,
      tasks: JSON.stringify(parsed.tasks),
      schedule: JSON.stringify(parsed.schedule),
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
