export type TaskType = "인강" | "문제집" | "암기" | "기타";

export type PlannerTask = {
  name: string;
  totalCount: number;
  unit: string;
  taskType: TaskType;
  minutesPerUnit: number; // 단위당 예상 소요시간(분)
  priority: number;       // 1(높음) ~ 5(낮음)
  deadline?: string;      // YYYY-MM-DD, 없으면 플랜 종료일
};

export type PlanConfig = {
  dailyMinutes: number;   // 하루 가용 학습시간(분)
  restDays: string[];     // ["일"] 또는 특정 날짜 "2026-06-01"
};

// ── schedule JSON 형식 ─────────────────────────────────────────
// { __meta__: PlanConfig, "YYYY-MM-DD": { taskName: amount }, ... }
export type ScheduleJson = {
  __meta__?: PlanConfig;
  [date: string]: Record<string, number> | PlanConfig | undefined;
};

export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay(); // 0=일, 6=토
}

function isRestDay(dateStr: string, restDays: string[]): boolean {
  const dow = dayOfWeek(dateStr);
  const dowNames = ["일", "월", "화", "수", "목", "금", "토"];
  return restDays.includes(dowNames[dow]) || restDays.includes(dateStr);
}

// 폴백용 단순 자동 분배 (AI 실패 시)
export function buildSchedule(
  dates: string[],
  tasks: PlannerTask[],
  config?: PlanConfig
): ScheduleJson {
  const restDays = config?.restDays ?? [];
  const activeDates = dates.filter((d) => !isRestDay(d, restDays));

  if (activeDates.length === 0 || tasks.length === 0) {
    const empty: ScheduleJson = { __meta__: config };
    dates.forEach((d) => { (empty as Record<string, unknown>)[d] = {}; });
    return empty;
  }

  const wds = activeDates.filter((d) => dayOfWeek(d) !== 0 && dayOfWeek(d) !== 6).length;
  const sats = activeDates.filter((d) => dayOfWeek(d) === 6).length;
  const suns = activeDates.filter((d) => dayOfWeek(d) === 0).length;
  const effectiveDays = wds + sats * 0.7 + suns * 0.5 || 1;

  const dailyMap: Record<string, { wd: number; sat: number; sun: number }> = {};
  for (const task of tasks) {
    const perWd = Math.max(1, Math.ceil(task.totalCount / effectiveDays));
    dailyMap[task.name] = {
      wd: perWd,
      sat: Math.max(0, Math.round(perWd * 0.7)),
      sun: Math.max(0, Math.round(perWd * 0.5)),
    };
  }

  const remaining: Record<string, number> = {};
  tasks.forEach((t) => (remaining[t.name] = t.totalCount));

  const schedule: ScheduleJson = { __meta__: config };

  for (const date of dates) {
    if (isRestDay(date, restDays)) {
      (schedule as Record<string, unknown>)[date] = {};
      continue;
    }
    const dow = dayOfWeek(date);
    const dayEntry: Record<string, number> = {};

    for (const task of tasks) {
      const left = remaining[task.name];
      if (left <= 0) continue;
      const daily = dailyMap[task.name];
      let amount = dow === 0 ? daily.sun : dow === 6 ? daily.sat : daily.wd;
      amount = Math.max(0, Math.min(amount, left));
      if (amount > 0) {
        dayEntry[task.name] = amount;
        remaining[task.name] -= amount;
      }
    }
    (schedule as Record<string, unknown>)[date] = dayEntry;
  }

  // 남은 분량 마지막 평일에 몰아넣기
  const leftover = tasks.filter((t) => remaining[t.name] > 0);
  if (leftover.length > 0) {
    const lastWd =
      [...activeDates].reverse().find((d) => dayOfWeek(d) !== 0 && dayOfWeek(d) !== 6) ??
      activeDates[activeDates.length - 1];
    for (const task of leftover) {
      const entry = ((schedule as Record<string, unknown>)[lastWd] ?? {}) as Record<string, number>;
      entry[task.name] = (entry[task.name] ?? 0) + remaining[task.name];
      (schedule as Record<string, unknown>)[lastWd] = entry;
    }
  }

  return schedule;
}

// AI 응답(schedule 배열) → 내부 ScheduleJson 변환
export function aiResponseToSchedule(
  aiSchedule: Array<{ date: string; tasks: Array<{ itemName: string; amount: number }> }>,
  config?: PlanConfig
): ScheduleJson {
  const result: ScheduleJson = { __meta__: config };
  for (const day of aiSchedule) {
    const entry: Record<string, number> = {};
    for (const t of day.tasks) {
      entry[t.itemName] = (entry[t.itemName] ?? 0) + t.amount;
    }
    (result as Record<string, unknown>)[day.date] = entry;
  }
  return result;
}

// schedule JSON에서 날짜별 항목 추출 (timetable·planner 뷰용)
export function getDaySchedule(schedule: ScheduleJson, date: string): Record<string, number> {
  const val = (schedule as Record<string, unknown>)[date];
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  // __meta__는 제외
  return val as Record<string, number>;
}

export function getMeta(schedule: ScheduleJson): PlanConfig | undefined {
  return schedule.__meta__;
}
