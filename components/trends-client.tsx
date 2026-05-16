"use client";

import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

type Subject = {
  id: string;
  name: string;
  optionName: string | null;
  rawScore: number | null;
  standardScore: number | null;
  percentile: number | null;
  grade: number | null;
  exam: { name: string; date: string | Date };
};

type Metric = "grade" | "standardScore" | "percentile" | "rawScore";

const METRIC_LABELS: Record<Metric, string> = {
  grade: "등급",
  standardScore: "표준점수",
  percentile: "백분위",
  rawScore: "원점수",
};

const LINE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function TrendsClient({ subjects }: { subjects: Subject[] }) {
  const [selectedSubject, setSelectedSubject] = useState("전체");
  const [metric, setMetric] = useState<Metric>("grade");

  const subjectNames = [...new Set(subjects.map((s) => s.name))];

  const chartData = useMemo(() => {
    const filtered = selectedSubject === "전체" ? subjects : subjects.filter((s) => s.name === selectedSubject);
    const byExam: Record<string, Record<string, number | string>> = {};

    for (const s of filtered) {
      const dateKey = new Date(s.exam.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
      if (!byExam[dateKey]) byExam[dateKey] = { date: dateKey, examName: s.exam.name };
      const key = s.optionName ? `${s.name}(${s.optionName})` : s.name;
      const val = s[metric];
      if (val != null) byExam[dateKey][key] = val;
    }
    return Object.values(byExam);
  }, [subjects, selectedSubject, metric]);

  const lineKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of chartData) {
      for (const k of Object.keys(row)) {
        if (k !== "date" && k !== "examName") keys.add(k);
      }
    }
    return [...keys];
  }, [chartData]);

  const avg = useMemo(() => {
    const vals = subjects
      .filter((s) => selectedSubject === "전체" || s.name === selectedSubject)
      .map((s) => s[metric])
      .filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [subjects, selectedSubject, metric]);

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };
  const inputStyle = { background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">점수 추이</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          회차별 성적 변화를 확인하세요.
        </p>
      </div>

      {/* 필터 */}
      <div className="rounded-xl border p-4 flex gap-3 flex-wrap" style={cardStyle}>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
          style={inputStyle}
        >
          <option value="전체">전체 과목</option>
          {subjectNames.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex gap-1">
          {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className="px-3 py-2 text-sm rounded-md"
              style={{
                background: metric === key ? "var(--primary)" : "var(--muted)",
                color: metric === key ? "var(--primary-foreground)" : "var(--foreground)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <div className="rounded-xl border p-5" style={cardStyle}>
        {chartData.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }}>데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis
                reversed={metric === "grade"}
                domain={metric === "grade" ? [1, 9] : undefined}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(v) => [`${v}${metric === "grade" ? "등급" : ""}`]}
              />
              <Legend />
              {avg != null && (
                <ReferenceLine
                  y={avg}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: `평균 ${avg.toFixed(1)}`, fill: "#94a3b8", fontSize: 11 }}
                />
              )}
              {lineKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 성적 테이블 */}
      {subjects.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--muted)" }}>
                <tr>
                  {["시험", "날짜", "과목", "원점수", "표준점수", "백분위", "등급"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects
                  .filter((s) => selectedSubject === "전체" || s.name === selectedSubject)
                  .reverse()
                  .map((s) => (
                    <tr key={s.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-2.5">{s.exam.name}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(s.exam.date).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.name}{s.optionName ? ` (${s.optionName})` : ""}
                      </td>
                      <td className="px-4 py-2.5">{s.rawScore ?? "-"}</td>
                      <td className="px-4 py-2.5">{s.standardScore ?? "-"}</td>
                      <td className="px-4 py-2.5">{s.percentile ?? "-"}</td>
                      <td className="px-4 py-2.5">
                        {s.grade ? (
                          <span className="font-bold" style={{ color: s.grade <= 2 ? "#10b981" : s.grade <= 4 ? "#f59e0b" : "#ef4444" }}>
                            {s.grade}등급
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
