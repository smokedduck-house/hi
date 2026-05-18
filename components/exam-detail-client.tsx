"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Pencil, ChevronDown, ChevronUp, TrendingDown } from "lucide-react";

// ── 타입 ─────────────────────────────────────────────────────
type Question = {
  id: string;
  number: number;
  unit: string;
  topic: string;
  isCorrect: boolean;
  wrongType: string | null;
  memo: string | null;
};

type Subject = {
  id: string;
  name: string;
  optionName: string | null;
  rawScore: number | null;
  standardScore: number | null;
  percentile: number | null;
  grade: number | null;
  maxRawScore: number;
  questions: Question[];
};

type Exam = {
  id: string;
  name: string;
  date: string;
  type: string;
  subjects: Subject[];
};

type ExamDataQuestion = {
  number: number;
  answer: string | null;
  score: number;
  correctRate: number | null;
  wrongRate: number | null;
  unit: string;
  topic: string;
};
type ExamDataSubject = {
  name: string;
  selectOption: string | null;
  questions: ExamDataQuestion[];
};
type ExamDataEntry = { name: string; date: string; year: number; type: string; subjects: ExamDataSubject[] };
type ExamData = { exams: ExamDataEntry[] };

// ── exam_data.json에서 시험 매칭 ─────────────────────────────
function findRefEntry(data: ExamData | null, examName: string): ExamDataEntry | null {
  if (!data) return null;
  return data.exams.find((e) => e.name === examName) ?? null;
}

function findRefSubject(entry: ExamDataEntry | null, name: string, optionName: string | null): ExamDataSubject | null {
  if (!entry) return null;
  if (name === "탐구") {
    return entry.subjects.find((s) => s.name === optionName || s.name === (optionName ?? "") + "I") ?? null;
  }
  // 한국지리, 지구과학I 직접 이름 매칭
  if (name === "한국지리" || name === "지구과학I") {
    return entry.subjects.find((s) => s.name === name) ?? null;
  }
  return entry.subjects.find(
    (s) =>
      s.name === name &&
      (!optionName || optionName === "공통" || s.selectOption === optionName)
  ) ?? null;
}

// ── 오답 유형 색상 ───────────────────────────────────────────
const WRONG_TYPE_COLORS: Record<string, string> = {
  개념부족: "#ef4444",
  실수: "#f59e0b",
  시간부족: "#3b82f6",
  문제이해실패: "#8b5cf6",
};

// ── 오답률 색상 ──────────────────────────────────────────────
function wrongRateColor(rate: number | null | undefined) {
  if (rate == null) return "var(--muted-foreground)";
  if (rate >= 70) return "#ef4444";
  if (rate >= 50) return "#f59e0b";
  if (rate >= 30) return "#6366f1";
  return "#10b981";
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export function ExamDetailClient({ exam }: { exam: Exam }) {
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/exam_data.json")
      .then((r) => r.json())
      .then(setExamData)
      .catch(() => {});
    // 첫 과목 기본 펼침
    if (exam.subjects.length > 0) {
      setExpandedSubjects(new Set([exam.subjects[0].id]));
    }
  }, [exam]);

  const refEntry = useMemo(() => findRefEntry(examData, exam.name), [examData, exam.name]);

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };
  const labelStyle: React.CSSProperties = {
    color: "var(--muted-foreground)",
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  };

  const dateStr = new Date(exam.date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">{exam.type}</Badge>
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{dateStr}</span>
          </div>
          <h2 className="text-2xl font-bold">{exam.name}</h2>
        </div>
        <Link
          href={`/exams/${exam.id}/edit`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
          style={{ ...cardStyle, color: "var(--muted-foreground)" }}
        >
          <Pencil size={12} /> 수정
        </Link>
      </div>

      {/* ── 과목별 성적 요약 ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {exam.subjects.map((s) => (
          <div key={s.id} className="rounded-xl border p-3 space-y-0.5" style={cardStyle}>
            <p className="text-xs font-semibold">
              {s.name}{s.optionName ? ` (${s.optionName})` : ""}
            </p>
            {s.grade != null && (
              <p className="text-xl font-bold" style={{ color: "var(--primary)" }}>{s.grade}등급</p>
            )}
            <div className="flex flex-wrap gap-x-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {s.rawScore != null && <span>원점수 {s.rawScore}</span>}
              {s.standardScore != null && <span>표점 {s.standardScore}</span>}
              {s.percentile != null && <span>백분위 {s.percentile}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── 과목별 문제 분석 ── */}
      {exam.subjects.map((subj) => {
        const refSubj = findRefSubject(refEntry, subj.name, subj.optionName);
        const isExpanded = expandedSubjects.has(subj.id);
        const wrongQs = subj.questions.filter((q) => !q.isCorrect);
        const totalQs = subj.questions.length;

        // 단원별 통계
        const unitStats: Record<string, { total: number; wrong: number; avgWrongRate: number | null; rates: (number | null)[] }> = {};
        for (const q of subj.questions) {
          const ref = refSubj?.questions.find((r) => r.number === q.number);
          const unit = q.unit || ref?.unit || "미분류";
          if (!unitStats[unit]) unitStats[unit] = { total: 0, wrong: 0, avgWrongRate: null, rates: [] };
          unitStats[unit].total++;
          if (!q.isCorrect) unitStats[unit].wrong++;
          if (ref?.wrongRate != null) unitStats[unit].rates.push(ref.wrongRate);
        }
        // 평균 오답률 계산
        for (const stat of Object.values(unitStats)) {
          const validRates = stat.rates.filter((r): r is number => r != null);
          stat.avgWrongRate = validRates.length > 0 ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length) : null;
        }
        const sortedUnits = Object.entries(unitStats).sort((a, b) => b[1].wrong - a[1].wrong);

        return (
          <div key={subj.id} className="rounded-2xl border overflow-hidden" style={cardStyle}>
            {/* 헤더 */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setExpandedSubjects((prev) => {
                const next = new Set(prev);
                next.has(subj.id) ? next.delete(subj.id) : next.add(subj.id);
                return next;
              })}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{subj.name}</span>
                {subj.optionName && <Badge variant="secondary">{subj.optionName}</Badge>}
                {totalQs > 0 && (
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    오답 {wrongQs.length}/{totalQs}
                  </span>
                )}
              </div>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isExpanded && (
              <div className="border-t px-5 pb-5 pt-4 space-y-5" style={{ borderColor: "var(--border)" }}>

                {totalQs === 0 ? (
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>문항 데이터 없음</p>
                ) : (
                  <>
                    {/* ── 단원별 요약 ── */}
                    {sortedUnits.length > 0 && (
                      <div className="space-y-2">
                        <p style={labelStyle}>단원별 오답</p>
                        <div className="space-y-1.5">
                          {sortedUnits.map(([unit, stat]) => (
                            <div key={unit} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs font-medium truncate">{unit}</span>
                                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: stat.wrong > 0 ? "#ef4444" : "#10b981" }}>
                                    {stat.wrong > 0 ? `${stat.wrong}개 오답` : "전부 정답"}
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.round((stat.wrong / stat.total) * 100)}%`,
                                      background: stat.wrong > 0 ? "#ef4444" : "#10b981",
                                    }}
                                  />
                                </div>
                              </div>
                              {stat.avgWrongRate != null && (
                                <span
                                  className="text-xs font-medium flex-shrink-0"
                                  style={{ color: wrongRateColor(stat.avgWrongRate), minWidth: "3.5rem", textAlign: "right" }}
                                  title="평균 추정 오답률"
                                >
                                  평균 {stat.avgWrongRate}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── 문항별 상세 ── */}
                    <div className="space-y-2">
                      <p style={labelStyle}>문항별 분석</p>
                      <div className="space-y-1">
                        {subj.questions.map((q) => {
                          const ref = refSubj?.questions.find((r) => r.number === q.number);
                          const unit = q.unit || ref?.unit || "";
                          const topic = q.topic || ref?.topic || "";
                          return (
                            <div
                              key={q.id}
                              className="flex items-start gap-2 px-3 py-2 rounded-lg"
                              style={{ background: q.isCorrect ? "transparent" : "rgba(239,68,68,0.05)" }}
                            >
                              {/* 번호 + 정오 */}
                              <div className="flex items-center gap-1.5 flex-shrink-0 w-12">
                                <span
                                  className="text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{
                                    background: q.isCorrect ? "#10b981" : "#ef4444",
                                    color: "white",
                                    fontSize: "0.55rem",
                                  }}
                                >
                                  {q.isCorrect ? "O" : "X"}
                                </span>
                                <span className="text-xs font-mono">{q.number}번</span>
                              </div>

                              {/* 단원/주제 */}
                              <div className="flex-1 min-w-0">
                                {unit && (
                                  <p className="text-xs font-medium leading-tight">{unit}</p>
                                )}
                                {topic && (
                                  <p className="text-xs leading-tight" style={{ color: "var(--muted-foreground)" }}>{topic}</p>
                                )}
                                {q.wrongType && (
                                  <span
                                    className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5"
                                    style={{ background: `${WRONG_TYPE_COLORS[q.wrongType] ?? "#6366f1"}22`, color: WRONG_TYPE_COLORS[q.wrongType] ?? "#6366f1", fontSize: "0.65rem" }}
                                  >
                                    {q.wrongType}
                                  </span>
                                )}
                                {q.memo && (
                                  <p className="text-xs mt-0.5 italic" style={{ color: "var(--muted-foreground)" }}>{q.memo}</p>
                                )}
                              </div>

                              {/* 배점 + 오답률 */}
                              <div className="flex-shrink-0 text-right space-y-0.5">
                                {ref?.score != null && (
                                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{ref.score}점</p>
                                )}
                                {ref?.wrongRate != null && (
                                  <p
                                    className="text-xs font-semibold flex items-center gap-0.5 justify-end"
                                    style={{ color: wrongRateColor(ref.wrongRate) }}
                                    title="추정 오답률"
                                  >
                                    <TrendingDown size={10} />
                                    {ref.wrongRate}%
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── 어려운 오답 문항 하이라이트 ── */}
                    {wrongQs.length > 0 && refSubj && (
                      <div className="space-y-2">
                        <p style={labelStyle}>오답 중 고난도 문항 (오답률 50% 이상)</p>
                        <div className="flex flex-wrap gap-2">
                          {wrongQs
                            .map((q) => {
                              const ref = refSubj.questions.find((r) => r.number === q.number);
                              return { q, ref };
                            })
                            .filter(({ ref }) => ref?.wrongRate != null && ref.wrongRate >= 50)
                            .sort((a, b) => (b.ref?.wrongRate ?? 0) - (a.ref?.wrongRate ?? 0))
                            .map(({ q, ref }) => (
                              <div
                                key={q.id}
                                className="rounded-lg px-3 py-2 text-xs space-y-0.5"
                                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                              >
                                <p className="font-bold">{q.number}번</p>
                                <p style={{ color: "var(--muted-foreground)" }}>{q.unit || ref?.unit}</p>
                                <p style={{ color: "#ef4444", fontWeight: 600 }}>오답률 {ref?.wrongRate}%</p>
                              </div>
                            ))}
                          {wrongQs
                            .map((q) => {
                              const ref = refSubj.questions.find((r) => r.number === q.number);
                              return { ref };
                            })
                            .filter(({ ref }) => ref?.wrongRate != null && ref.wrongRate >= 50).length === 0 && (
                            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>해당 없음</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
