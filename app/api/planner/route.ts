import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite";

// AI는 날짜별 배분을 하지 않고 "하루 페이스"만 결정.
// 실제 날짜별 스케줄은 서버가 수학적으로 생성해서 합계를 정확히 맞춤.
const SYSTEM_PROMPT = `너는 수능 수험생 전문 학습 플래너야.
할 일 목록을 분석해서 과제명·총수량·현실적인 하루 학습량을 결정해.

━━━ 하루 기준 적정량 (사용자 명시 없을 때) ━━━
- 인강 (수학·과학 등 어려운 과목): 평일 1~2강
- 인강 (영어·국어 등): 평일 2~3강
- 기출 문제: 평일 10~20문제 (수학은 5~10문제)
- 교재·읽기: 평일 20~40쪽
- 단어·암기: 평일 30~60개
→ 사용자가 하루 가능한 양을 명시했으면 그 수치 최우선.

━━━ 출력 형식 (순수 JSON만. 코드블록 \`\`\` 절대 금지) ━━━
{
  "tasks": [
    {
      "name": "과제명",
      "totalCount": 총수량,
      "unit": "강/문제/쪽/개",
      "dailyWeekday": 평일하루수량,
      "dailySaturday": 토요일하루수량,
      "dailySunday": 일요일하루수량
    }
  ]
}

━━━ 규칙 ━━━
1. tasks[].name은 짧고 명확하게. 수량·단위 포함 절대 금지.
   ("뉴런 수2 40강" ✗ → "뉴런 수2" ✓)
2. 강의 목록이 주어지면 강 제목·번호를 직접 세서 totalCount 계산.
3. dailySaturday ≈ dailyWeekday × 0.7 (정수, 최소 0)
4. dailySunday ≈ dailyWeekday × 0.5 (정수, 0도 허용)
5. 추가 요청사항 최우선 반영.`;

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

// ── 서버사이드 스케줄 생성 (합계 수학적으로 정확 보장) ─────────
type AiTask = {
  name: string;
  totalCount: number;
  unit: string;
  dailyWeekday: number;
  dailySaturday: number;
  dailySunday: number;
};

function buildSchedule(
  dates: string[],
  tasks: AiTask[]
): Record<string, Record<string, number>> {
  const remaining: Record<string, number> = {};
  tasks.forEach((t) => (remaining[t.name] = t.totalCount));

  const schedule: Record<string, Record<string, number>> = {};

  for (const date of dates) {
    const dow = new Date(date).getDay(); // 0=일, 6=토
    schedule[date] = {};

    for (const task of tasks) {
      const left = remaining[task.name];
      if (left <= 0) { schedule[date][task.name] = 0; continue; }

      let amount = dow === 0 ? task.dailySunday
                 : dow === 6 ? task.dailySaturday
                 : task.dailyWeekday;

      amount = Math.max(0, Math.min(amount, left));
      schedule[date][task.name] = amount;
      remaining[task.name] -= amount;
    }
  }

  // 기간이 끝났는데 남은 게 있으면 마지막 평일에 몰아넣기
  const leftOver = tasks.filter((t) => remaining[t.name] > 0);
  if (leftOver.length > 0) {
    const lastWeekday = [...dates].reverse().find((d) => {
      const dow = new Date(d).getDay();
      return dow !== 0 && dow !== 6;
    }) ?? dates[dates.length - 1];
    for (const task of leftOver) {
      schedule[lastWeekday][task.name] = (schedule[lastWeekday][task.name] ?? 0) + remaining[task.name];
      remaining[task.name] = 0;
    }
  }

  return schedule;
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
    `시작일: ${startDate} / 종료일: ${endDate} / 총 일수: ${dates.length}일`,
    dailyCapacity?.trim() ? `하루 가능한 양: ${dailyCapacity.trim()}` : "",
    `\n할 일 목록:\n${taskInfo.trim()}`,
    description?.trim() ? `\n추가 요청사항:\n${description.trim()}` : "",
  ].filter(Boolean).join("\n");

  const ai = new GoogleGenAI({ apiKey });
  let aiTasks: AiTask[];

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 2000, temperature: 0.2 },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
    });
    const raw = result.text ?? "";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { tasks: AiTask[] };
    aiTasks = parsed.tasks;
  } catch (err) {
    return NextResponse.json({ error: "AI 분석 실패", detail: String(err) }, { status: 500 });
  }

  if (!aiTasks?.length)
    return NextResponse.json({ error: "AI 응답 형식 오류" }, { status: 500 });

  // 서버가 수학적으로 정확한 스케줄 생성
  const scheduleJson = buildSchedule(dates, aiTasks);

  // DB에 저장할 tasks는 dailyWeekday 등 제외한 기본 필드만
  const tasksForDb = aiTasks.map(({ name, totalCount, unit }) => ({ name, totalCount, unit }));

  const plan = await prisma.studyPlan.create({
    data: {
      title,
      startDate,
      endDate,
      tasks: JSON.stringify(tasksForDb),
      schedule: JSON.stringify(scheduleJson),
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
