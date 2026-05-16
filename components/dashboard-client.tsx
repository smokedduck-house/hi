"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import Link from "next/link";

const GRADE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const WRONG_TYPE_COLORS: Record<string, string> = {
  개념부족: "#ef4444",
  실수: "#f59e0b",
  시간부족: "#3b82f6",
  문제이해실패: "#8b5cf6",
  미분류: "#94a3b8",
};

type Subject = {
  id: string;
  name: string;
  optionName: string | null;
  rawScore: number | null;
  standardScore: number | null;
  percentile: number | null;
  grade: number | null;
  questions: { isCorrect: boolean }[];
};

type Exam = {
  id: string;
  name: string;
  date: string | Date;
  type: string;
  grade: string;
  subjects: Subject[];
};

type TrendSubject = {
  name: string;
  grade: number | null;
  exam: { date: string | Date; name: string };
};

type Props = {
  recentExams: Exam[];
  topWrongUnits: { unit: string; count: number }[];
  wrongTypeDistribution: { type: string; count: number }[];
  trendSubjects: TrendSubject[];
};

function gradeColor(grade: number | null) {
  if (!grade) return "#94a3b8";
  if (grade === 1) return "#3b82f6";
  if (grade === 2) return "#10b981";
  if (grade <= 4) return "#f59e0b";
  return "#ef4444";
}

export function DashboardClient({ recentExams, topWrongUnits, wrongTypeDistribution, trendSubjects }: Props) {
  // 과목별 등급 추이 데이터 가공
  const subjectNames = [...new Set(trendSubjects.map((s) => s.name))];
  const examDates = [...new Set(trendSubjects.map((s) => new Date(s.exam.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })))].reverse();

  const trendData = examDates.map((dateLabel) => {
    const row: Record<string, string | number> = { date: dateLabel };
    for (const sub of subjectNames) {
      const match = trendSubjects.find(
        (s) =>
          s.name === sub &&
          new Date(s.exam.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) === dateLabel
      );
      if (match?.grade) row[sub] = match.grade;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">대시보드</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          최근 성적 요약 및 취약점 분석
        </p>
      </div>

      {/* 최근 시험 카드 */}
      <section>
        <h3 className="text-base font-semibold mb-3">최근 모의고사</h3>
        {recentExams.length === 0 ? (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)" }}
          >
            <p className="mb-3">아직 입력된 모의고사가 없습니다.</p>
            <Link
              href="/exams/new"
              className="text-sm font-medium px-4 py-2 rounded-lg"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              첫 모의고사 입력하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentExams.map((exam) => {
              const totalQ = exam.subjects.flatMap((s) => s.questions).length;
              const wrongQ = exam.subjects.flatMap((s) => s.questions).filter((q) => !q.isCorrect).length;
              return (
                <div
                  key={exam.id}
                  className="rounded-xl border p-4 space-y-3"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm leading-tight">{exam.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(exam.date).toLocaleDateString("ko-KR")} · {exam.type}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                      {exam.grade}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {exam.subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between text-xs">
                        <span style={{ color: "var(--muted-foreground)" }}>
                          {sub.name}{sub.optionName ? ` (${sub.optionName})` : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          {sub.rawScore != null && (
                            <span>{sub.rawScore}점</span>
                          )}
                          {sub.grade && (
                            <span
                              className="font-bold px-1.5 py-0.5 rounded text-white"
                              style={{ background: gradeColor(sub.grade), fontSize: "0.65rem" }}
                            >
                              {sub.grade}등급
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalQ > 0 && (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      오답 {wrongQ}/{totalQ}문항
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 많이 틀린 단원 Top 5 */}
        <section
          className="rounded-xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="text-base font-semibold mb-4">많이 틀린 단원 Top 5</h3>
          {topWrongUnits.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {topWrongUnits.map(({ unit, count }, i) => (
                <div key={unit} className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: GRADE_COLORS[i] ?? "#94a3b8" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{unit}</p>
                    <div
                      className="mt-1 h-1.5 rounded-full"
                      style={{ background: "var(--border)", overflow: "hidden" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / (topWrongUnits[0]?.count ?? 1)) * 100}%`,
                          background: GRADE_COLORS[i] ?? "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0">{count}회</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 오답 유형 분포 */}
        <section
          className="rounded-xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="text-base font-semibold mb-4">오답 유형 분포</h3>
          {wrongTypeDistribution.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>데이터가 없습니다.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={wrongTypeDistribution} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                    {wrongTypeDistribution.map((entry) => (
                      <Cell key={entry.type} fill={WRONG_TYPE_COLORS[entry.type] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}건`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {wrongTypeDistribution.map((entry) => (
                  <div key={entry.type} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: WRONG_TYPE_COLORS[entry.type] ?? "#94a3b8" }} />
                    <span className="flex-1">{entry.type}</span>
                    <span className="font-semibold">{entry.count}건</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 과목별 등급 추이 */}
      {trendData.length > 0 && (
        <section
          className="rounded-xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="text-base font-semibold mb-4">과목별 등급 추이</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis reversed domain={[1, 9]} tick={{ fontSize: 12 }} label={{ value: "등급", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {subjectNames.map((sub, i) => (
                <Line
                  key={sub}
                  type="monotone"
                  dataKey={sub}
                  stroke={GRADE_COLORS[i % GRADE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
