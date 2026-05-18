export type PlannerTask = {
  name: string;
  totalCount: number;
  unit: string;
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

// 총량을 기간에 맞게 자동 분배
// 평일=1.0, 토=0.7, 일=0.5 비율로 균등 배분
export function buildSchedule(
  dates: string[],
  tasks: PlannerTask[]
): Record<string, Record<string, number>> {
  if (dates.length === 0 || tasks.length === 0) {
    return Object.fromEntries(dates.map((d) => [d, {}]));
  }

  // 날짜 유형별 카운트
  const wds = dates.filter((d) => dayOfWeek(d) !== 0 && dayOfWeek(d) !== 6).length;
  const sats = dates.filter((d) => dayOfWeek(d) === 6).length;
  const suns = dates.filter((d) => dayOfWeek(d) === 0).length;
  const effectiveDays = wds + sats * 0.7 + suns * 0.5 || 1;

  // 각 task의 하루 목표량 계산
  const dailyMap: Record<string, { wd: number; sat: number; sun: number }> = {};
  for (const task of tasks) {
    const perWd = Math.max(1, Math.ceil(task.totalCount / effectiveDays));
    const perSat = Math.max(0, Math.round(perWd * 0.7));
    const perSun = Math.max(0, Math.round(perWd * 0.5));
    dailyMap[task.name] = { wd: perWd, sat: perSat, sun: perSun };
  }

  // 남은 수량 추적
  const remaining: Record<string, number> = {};
  tasks.forEach((t) => (remaining[t.name] = t.totalCount));

  const schedule: Record<string, Record<string, number>> = {};

  for (const date of dates) {
    const dow = dayOfWeek(date);
    schedule[date] = {};

    for (const task of tasks) {
      const left = remaining[task.name];
      if (left <= 0) continue;

      const daily = dailyMap[task.name];
      let amount = dow === 0 ? daily.sun : dow === 6 ? daily.sat : daily.wd;
      amount = Math.max(0, Math.min(amount, left));

      if (amount > 0) {
        schedule[date][task.name] = amount;
        remaining[task.name] -= amount;
      }
    }
  }

  // 기간 내 다 못 끝낸 경우 마지막 평일에 몰아넣기
  const leftOverTasks = tasks.filter((t) => remaining[t.name] > 0);
  if (leftOverTasks.length > 0) {
    const lastWeekday =
      [...dates].reverse().find((d) => dayOfWeek(d) !== 0 && dayOfWeek(d) !== 6) ??
      dates[dates.length - 1];
    for (const task of leftOverTasks) {
      schedule[lastWeekday][task.name] =
        (schedule[lastWeekday][task.name] ?? 0) + remaining[task.name];
      remaining[task.name] = 0;
    }
  }

  return schedule;
}
