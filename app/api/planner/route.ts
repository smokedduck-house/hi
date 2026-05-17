import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `너는 수능 수험생 전문 학습 플래너야.
사용자가 올린 할 일 목록을 분석하고, 현실적으로 매일 실천 가능한 학습 계획을 JSON으로 만들어.

━━━ 핵심 원칙 ━━━
【절대 금지】단순히 (총량 ÷ 일수) 계산으로 배분하지 마.
수험생이 하루에 실제로 소화할 수 있는 적정량을 기준으로 페이스를 잡아.

━━━ 하루 기준 적정량 (사용자 명시 없을 때) ━━━
- 인강 (수학·과학 등 어려운 과목): 1~2강
- 인강 (영어·국어 등 상대적으로 쉬운 과목): 2~3강
- 기출 문제: 10~20문제 (수학 기출은 5~10문제)
- 교재·독서: 20~40쪽
- 단어·암기: 30~60개
→ 사용자가 하루 가능한 양을 명시했으면 그 수치를 최우선으로 따를 것.

━━━ 배분 규칙 ━━━
1. 강의 목록이 주어지면 강 제목/번호를 직접 세서 totalCount를 계산.
2. 일요일: 평일의 50% (0도 허용), 토요일: 평일의 70%.
3. 총량이 기간에 비해 적으면 → 앞쪽에 몰아서 끝내고 나머지 날은 0. (억지로 퍼뜨리지 마.)
4. 총량이 기간에 비해 너무 많으면 → 하루 양을 현실적으로 늘리되 절대 과부하 금지.
5. 추가 요청사항 최우선 반영.
6. tasks[].totalCount 합계 = schedule 전체 수량 합계 (정확히 일치해야 함).
7. 수량이 0인 날도 모든 과제 키를 반드시 포함.
8. ★tasks[].name은 순수 과제명만. 수량·단위 절대 포함 금지.
   (예: "뉴런 수2 40강" ✗ → "뉴런 수2" ✓)

━━━ 출력 형식 (순수 JSON만. 코드블록 \`\`\` 절대 금지) ━━━
{
  "tasks": [
    {"name": "과제명", "totalCount": 총수량, "unit": "강/문제/쪽/개"}
  ],
  "schedule": {
    "YYYY-MM-DD": {"과제명": 수량},
    ...
  }
}`;

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

  const { title, startDate, endDate, taskInfo, dailyCapacity, description } = await req.json() as {
    title: string;
    startDate: string;
    endDate: string;
    taskInfo: string;
    dailyCapacity?: string;
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
    dailyCapacity?.trim() ? `하루 가능한 양: ${dailyCapacity.trim()}` : "",
    `\n할 일 목록:\n${taskInfo.trim()}`,
    description?.trim() ? `\n추가 요청사항:\n${description.trim()}` : "",
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
