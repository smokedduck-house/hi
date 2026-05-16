"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Question = {
  id: string;
  unit: string;
  isCorrect: boolean;
  wrongType: string | null;
  subject: { name: string; optionName: string | null };
};

type SubjectMeta = { name: string; optionName: string | null };

const WRONG_TYPE_COLORS: Record<string, string> = {
  개념부족: "#ef4444",
  실수: "#f59e0b",
  시간부족: "#3b82f6",
  문제이해실패: "#8b5cf6",
};

export function WeaknessClient({ questions, subjects }: { questions: Question[]; subjects: SubjectMeta[] }) {
  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  // 단원별 정답률
  const unitStats = useMemo(() => {
    const stats: Record<string, { total: number; wrong: number; subject: string }> = {};
    for (const q of questions) {
      const key = `${q.subject.name}::${q.unit}`;
      if (!stats[key]) stats[key] = { total: 0, wrong: 0, subject: q.subject.name };
      stats[key].total++;
      if (!q.isCorrect) stats[key].wrong++;
    }
    return Object.entries(stats)
      .map(([key, v]) => ({
        unit: key.split("::")[1],
        subject: v.subject,
        total: v.total,
        wrong: v.wrong,
        accuracy: Math.round(((v.total - v.wrong) / v.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [questions]);

  // 반복 취약 단원 (3회 이상 오답)
  const repeatedWeak = unitStats.filter((u) => u.wrong >= 3);

  // 오답 유형 통계
  const wrongTypeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const q of questions.filter((q) => !q.isCorrect && q.wrongType)) {
      stats[q.wrongType!] = (stats[q.wrongType!] ?? 0) + 1;
    }
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return Object.entries(stats)
      .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [questions]);

  const topWrongType = wrongTypeStats[0];

  // 학습 우선순위
  const priorityList = unitStats.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">취약점 분석</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          반복 취약 단원과 오답 패턴을 파악하세요.
        </p>
      </div>

      {/* 인사이트 카드 */}
      {topWrongType && (
        <div
          className="rounded-xl border p-4 flex gap-4 items-start"
          style={{ ...cardStyle, borderLeft: "4px solid var(--primary)" }}
        >
          <div className="text-2xl">💡</div>
          <div>
            <p className="font-semibold">
              오답의 <span style={{ color: "var(--primary)" }}>{topWrongType.pct}%</span>가 <span style={{ color: WRONG_TYPE_COLORS[topWrongType.type] ?? "inherit" }}>{topWrongType.type}</span>입니다.
            </p>
            {topWrongType.type === "개념부족" && <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>개념 정리 노트를 만들고 반복 학습하는 것을 권장합니다.</p>}
            {topWrongType.type === "실수" && <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>풀이 후 반드시 검산하는 습관을 들이세요.</p>}
            {topWrongType.type === "시간부족" && <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>시간 배분 전략을 세우고 타이머로 문제별 시간을 체크하세요.</p>}
            {topWrongType.type === "문제이해실패" && <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>문제 핵심어에 밑줄 치는 습관과 지문 요약 연습을 해보세요.</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 오답 유형 분포 */}
        <section className="rounded-xl border p-5" style={cardStyle}>
          <h3 className="font-semibold mb-4">오답 유형별 통계</h3>
          {wrongTypeStats.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)" }}>데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {wrongTypeStats.map(({ type, count, pct }) => (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{type}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{count}건 ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: WRONG_TYPE_COLORS[type] ?? "#94a3b8" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 반복 취약 단원 */}
        <section className="rounded-xl border p-5" style={cardStyle}>
          <h3 className="font-semibold mb-1">반복 취약 단원</h3>
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>3회 이상 오답 단원</p>
          {repeatedWeak.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)" }} className="text-sm">반복 취약 단원이 없습니다. 잘 하고 있어요!</p>
          ) : (
            <div className="space-y-2">
              {repeatedWeak.map((u) => (
                <div
                  key={u.unit}
                  className="flex items-center gap-3 p-2.5 rounded-lg"
                  style={{ background: "var(--muted)" }}
                >
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{u.unit}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{u.subject} · 정답률 {u.accuracy}%</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#ef4444" }}>{u.wrong}회</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 단원별 정답률 차트 */}
      {unitStats.length > 0 && (
        <section className="rounded-xl border p-5" style={cardStyle}>
          <h3 className="font-semibold mb-4">단원별 정답률 (낮은 순)</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, unitStats.slice(0, 12).length * 32)}>
            <BarChart
              layout="vertical"
              data={unitStats.slice(0, 12).map((u) => ({ ...u, label: `${u.subject} · ${u.unit}` }))}
              margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={160} />
              <Tooltip formatter={(v) => [`${v}%`, "정답률"]} />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                {unitStats.slice(0, 12).map((u, i) => (
                  <Cell
                    key={i}
                    fill={u.accuracy < 40 ? "#ef4444" : u.accuracy < 70 ? "#f59e0b" : "#10b981"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* 학습 우선순위 */}
      {priorityList.length > 0 && (
        <section className="rounded-xl border p-5" style={cardStyle}>
          <h3 className="font-semibold mb-1">추천 학습 우선순위</h3>
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>정답률이 낮은 단원부터 집중 학습하세요</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {priorityList.map((u, i) => (
              <div
                key={u.unit}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ borderColor: "var(--border)", background: i < 3 ? "rgba(239,68,68,0.05)" : "var(--muted)" }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: i < 3 ? "#ef4444" : i < 6 ? "#f59e0b" : "#94a3b8" }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.unit}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{u.subject} · 정답률 {u.accuracy}%</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
