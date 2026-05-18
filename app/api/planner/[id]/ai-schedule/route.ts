import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { dateRange, aiResponseToSchedule, buildSchedule } from "@/lib/planner-utils";
import type { PlannerTask, PlanConfig } from "@/lib/planner-utils";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `당신은 학습 계획 분배 전문가입니다. 사용자가 제공한 학습 목록을 주어진 기간에 균형 있게 자동 분배하는 역할을 합니다.

[분배 원칙]
1. 마감일이 빠른 항목을 먼저 배치하되, 마감 직전에 몰리지 않게 한다.
2. 하루에 한 종류만 몰지 말고 가능한 한 인강 + 문제집 + 암기를 섞어 인지 부하를 분산한다.
3. 우선순위가 높은 항목(1에 가까울수록 높음)을 컨디션이 좋은 평일 앞쪽에 배치한다.
4. 하루 총 학습시간이 가용시간의 90~110% 범위에 들어오도록 조정한다. 초과 시 다음날로 이월.
5. 인강은 연속된 강의를 같은 날 또는 연속된 날에 배치해 흐름을 유지한다.
6. 문제집은 인강이 끝난 단원의 문제부터 풀도록 인강보다 1~2일 뒤에 배치한다.
7. 휴식일에는 절대 배치하지 않는다.
8. 모든 항목이 마감일 이전에 100% 완료되도록 보장한다. 불가능하면 warnings에 사유를 한국어로 적는다.
9. 마지막 2~3일은 가벼운 복습/오답정리용으로 비워두는 것을 권장한다.

[출력 규칙]
- 반드시 지정된 JSON 스키마를 따른다.
- 각 날짜별로 해야 할 항목, 분량, 예상 소요시간을 명시한다.
- 추가 설명이나 마크다운 없이 JSON만 반환한다.`;

const responseSchema = {
  type: "object",
  properties: {
    schedule: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          dayOfWeek: { type: "string" },
          totalMinutes: { type: "integer" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                itemName: { type: "string" },
                type: { type: "string", enum: ["인강", "문제집", "암기", "기타"] },
                rangeFrom: { type: "string", description: "예: 1강, 12p, 1번" },
                rangeTo: { type: "string" },
                amount: { type: "integer", description: "강의 수, 페이지 수 등" },
                estimatedMinutes: { type: "integer" },
              },
              required: ["itemName", "type", "amount", "estimatedMinutes"],
            },
          },
        },
        required: ["date", "tasks", "totalMinutes"],
      },
    },
    summary: {
      type: "object",
      properties: {
        totalDays: { type: "integer" },
        avgDailyMinutes: { type: "integer" },
        completionByItem: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemName: { type: "string" },
              completionRate: { type: "number" },
              finishDate: { type: "string" },
            },
          },
        },
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["schedule", "summary"],
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existing = await prisma.studyPlan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "플랜 없음" }, { status: 404 });

  const tasks: PlannerTask[] = JSON.parse(existing.tasks || "[]");
  if (tasks.length === 0) return NextResponse.json({ error: "할 일이 없습니다" }, { status: 400 });

  // 요청 body에서 config 받기 (없으면 기존 schedule에서 추출)
  const body = await req.json().catch(() => ({})) as Partial<PlanConfig>;
  const existingSchedule = JSON.parse(existing.schedule || "{}") as Record<string, unknown>;
  const savedMeta = existingSchedule.__meta__ as PlanConfig | undefined;

  const config: PlanConfig = {
    dailyMinutes: body.dailyMinutes ?? savedMeta?.dailyMinutes ?? 240,
    restDays: body.restDays ?? savedMeta?.restDays ?? ["일"],
  };

  const dates = dateRange(existing.startDate, existing.endDate);
  const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

  // 학습 항목 텍스트 구성
  const itemsText = tasks
    .map((t) => {
      const deadline = t.deadline ?? existing.endDate;
      return `- ${t.name} (${t.taskType}, 총 ${t.totalCount}${t.unit}, ${t.unit}당 ${t.minutesPerUnit}분, 우선순위 ${t.priority}, 마감 ${deadline})`;
    })
    .join("\n");

  const restDaysText = config.restDays.length > 0 ? config.restDays.join(", ") : "없음";

  const userPrompt = `다음 정보를 바탕으로 학습 계획을 분배해주세요.

기간: ${existing.startDate} ~ ${existing.endDate}
하루 가용 시간: ${config.dailyMinutes}분
휴식일: ${restDaysText}

학습 항목:
${itemsText}

위 정보를 바탕으로 JSON 스키마에 맞춰 일자별 학습 계획을 반환하세요.`;

  try {
    const result = await genAI.models.generateContent({
      model: MODEL,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.3,
      },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const text = result.text ?? "";
    const aiResult = JSON.parse(text) as {
      schedule: Array<{ date: string; dayOfWeek?: string; totalMinutes: number; tasks: Array<{ itemName: string; type: string; amount: number; estimatedMinutes: number; rangeFrom?: string; rangeTo?: string }> }>;
      summary: { totalDays: number; avgDailyMinutes: number; completionByItem: Array<{ itemName: string; completionRate: number; finishDate: string }> };
      warnings?: string[];
    };

    // AI 응답 → 내부 schedule 형식으로 변환 + 누락 날짜 채우기
    const newSchedule = aiResponseToSchedule(aiResult.schedule, config);
    // AI에 없는 날짜는 빈 객체로
    for (const date of dates) {
      if (!(newSchedule as Record<string, unknown>)[date]) {
        (newSchedule as Record<string, unknown>)[date] = {};
      }
    }

    const updated = await prisma.studyPlan.update({
      where: { id },
      data: { schedule: JSON.stringify(newSchedule) },
      include: { completions: true },
    });

    return NextResponse.json({
      plan: updated,
      summary: aiResult.summary,
      warnings: aiResult.warnings ?? [],
    });
  } catch (err) {
    console.error("AI scheduling failed:", err);

    // 폴백: 단순 자동 분배
    const fallbackSchedule = buildSchedule(dates, tasks, config);
    const updated = await prisma.studyPlan.update({
      where: { id },
      data: { schedule: JSON.stringify(fallbackSchedule) },
      include: { completions: true },
    });

    return NextResponse.json({
      plan: updated,
      summary: null,
      warnings: ["AI 분배 실패, 기본 균등 분배로 대체했습니다."],
      fallback: true,
    });
  }
}
