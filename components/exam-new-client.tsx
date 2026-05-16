"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, Zap } from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────
type Unit = { id: string; subjectName: string; optionName: string | null; name: string };

type ExamDataQuestion = {
  number: number;
  answer: string | null;
  score: number;
  correctRate: number | null;
};
type ExamDataSubject = {
  name: string;
  selectOption: string | null;
  cutoffs: Record<string, { rawScore?: number; standardScore?: number }> | null;
  questions: ExamDataQuestion[];
};
type ExamDataEntry = { name: string; year: number; type: string; subjects: ExamDataSubject[] };
type ExamData = { exams: ExamDataEntry[] };

type GradeResult = { number: number; correct: string; mine: string; isCorrect: boolean; score: number };

type Timings = { hwajak: string; munhak: string; dokso: string };

type SubjectInput = {
  name: string;
  optionName: string;
  rawScore: string;
  standardScore: string;
  percentile: string;
  grade: string;
  maxRawScore: string;
  // 오답 (수동 모드)
  wrongNumbers: string; // 쉼표 구분 "3,7,15"
  // 자동채점
  myAnswers: Record<string, string>;
  gradeResults: GradeResult[] | null;
  // 정답지 입력 (수동)
  answerKeyCount: string; // 총 문항 수
  answerKey: Record<string, string>; // { "1": "3", "2": "1", ... }
  // 국어 시간
  timings: Timings;
  expanded: boolean;
};

// ── 상수 ──────────────────────────────────────────────────────
const TYPES = ["평가원", "교육청", "사설"] as const;
type ExamType = (typeof TYPES)[number];

const MONTHS_BY_TYPE: Record<ExamType, number[]> = {
  평가원: [6, 9, 11],
  교육청: [3, 4, 7, 10, 11],
  사설: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

const YEARS = [2023, 2024, 2025, 2026, 2027];

const SUBJECT_OPTIONS: Record<string, string[]> = {
  국어: ["화법과작문"],
  수학: ["미적분"],
  영어: ["공통"],
  한국사: ["공통"],
  탐구: ["한국지리", "지구과학"],
};

// ── 시험명/날짜 생성 ───────────────────────────────────────────
function buildExamInfo(type: ExamType | "", year: number | null, month: number | null) {
  if (!type || !year || !month) return null;
  if (type === "평가원") {
    const cy = year - 1;
    if (month === 11) return { name: `${year}학년도 수능`, date: `${cy}-11-15` };
    return { name: `${year}학년도 ${month}월 모의평가`, date: `${cy}-${String(month).padStart(2, "0")}-01` };
  }
  if (type === "교육청") {
    return { name: `${year}년 ${month}월 전국연합학력평가`, date: `${year}-${String(month).padStart(2, "0")}-01` };
  }
  return { name: `${year}년 ${month}월 사설모의고사`, date: `${year}-${String(month).padStart(2, "0")}-01` };
}

// ── exam_data.json에서 매칭 찾기 ─────────────────────────────
function findExamEntry(data: ExamData | null, year: number, month: number, type: ExamType): ExamDataEntry | null {
  if (!data || type !== "평가원") return null;
  const examType = month === 11 ? "수능" : `${month}월 모평`;
  return data.exams.find((e) => e.year === year && e.type === examType) ?? null;
}

function findSubjectEntry(entry: ExamDataEntry | null, name: string, optionName: string): ExamDataSubject | null {
  if (!entry) return null;
  // 탐구 과목은 exam_data.json에서 subject name이 optionName 그 자체 (한국지리, 지구과학I 등)
  if (name === "탐구") {
    return entry.subjects.find(
      (s) => s.name === optionName || s.name === optionName + "I"
    ) ?? null;
  }
  return (
    entry.subjects.find(
      (s) =>
        s.name === name &&
        (optionName === "" || optionName === "공통" || s.selectOption === optionName)
    ) ?? null
  );
}

// ── 기본값 ────────────────────────────────────────────────────
function defaultSubject(name: string): SubjectInput {
  const opts = SUBJECT_OPTIONS[name] ?? [];
  const autoOption = opts.length === 1 && opts[0] !== "공통" ? opts[0] : "";
  return {
    name,
    optionName: autoOption,
    rawScore: "",
    standardScore: "",
    percentile: "",
    grade: "",
    maxRawScore: name === "탐구" ? "50" : "100",
    wrongNumbers: "",
    myAnswers: {},
    gradeResults: null,
    answerKeyCount: "",
    answerKey: {},
    timings: { hwajak: "", munhak: "", dokso: "" },
    expanded: true,
  };
}

// ── 칩 컴포넌트 ───────────────────────────────────────────────
function Chip({ label, selected, onClick, size = "sm" }: { label: string; selected: boolean; onClick: () => void; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border font-medium transition-all whitespace-nowrap ${size === "md" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs"}`}
      style={{
        borderColor: selected ? "var(--primary)" : "var(--border)",
        background: selected ? "var(--primary)" : "transparent",
        color: selected ? "var(--primary-foreground)" : "var(--muted-foreground)",
      }}
    >
      {label}
    </button>
  );
}

// ── 답안 셀 ──────────────────────────────────────────────────
function AnswerCell({ num, value, onChange, highlight, readOnly, autoAdvance }: {
  num: number; value: string; onChange?: (v: string) => void;
  highlight?: "correct" | "wrong" | "correct-answer"; readOnly?: boolean;
  autoAdvance?: boolean;
}) {
  const bg =
    highlight === "correct" ? "rgba(16,185,129,0.15)" :
    highlight === "wrong"   ? "rgba(239,68,68,0.15)"  :
    highlight === "correct-answer" ? "rgba(99,102,241,0.1)" :
    "var(--muted)";
  const border =
    highlight === "correct" ? "#10b981" :
    highlight === "wrong"   ? "#ef4444"  :
    highlight === "correct-answer" ? "#6366f1" :
    "var(--border)";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9]/g, "");
    onChange?.(v);
    if (autoAdvance && v.length === 1) {
      const container = e.target.closest(".answer-cells");
      if (container) {
        const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input[data-cell]"));
        const idx = inputs.indexOf(e.target);
        if (idx !== -1 && idx + 1 < inputs.length) inputs[idx + 1].focus();
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.6rem]" style={{ color: "var(--muted-foreground)" }}>{num}</span>
      <input
        readOnly={readOnly}
        type="text"
        maxLength={4}
        value={value}
        data-cell={autoAdvance ? "1" : undefined}
        onChange={handleChange}
        className="w-9 h-8 text-center text-xs font-bold rounded border outline-none transition-colors"
        style={{ background: bg, borderColor: border, color: "var(--foreground)", cursor: readOnly ? "default" : "text" }}
      />
    </div>
  );
}

// ── DB에서 불러온 시험 타입 ───────────────────────────────────
type ExamRecord = {
  id: string;
  name: string;
  date: string;
  type: string;
  subjects: {
    name: string;
    optionName: string | null;
    rawScore: number | null;
    standardScore: number | null;
    percentile: number | null;
    grade: number | null;
    maxRawScore: number;
    notes: string | null;
    questions: { number: number; unit: string; isCorrect: boolean; wrongType?: string | null; memo?: string | null }[];
  }[];
};

function examToSubjectInputs(exam: ExamRecord): SubjectInput[] {
  return exam.subjects.map((s) => {
    const wrongNums = s.questions.filter((q) => !q.isCorrect).map((q) => q.number).join(", ");
    let timings: Timings = { hwajak: "", munhak: "", dokso: "" };
    if (s.notes) {
      try { const n = JSON.parse(s.notes); if (n.timings) timings = n.timings; } catch {}
    }
    return {
      name: s.name,
      optionName: s.optionName ?? "",
      rawScore: s.rawScore != null ? String(s.rawScore) : "",
      standardScore: s.standardScore != null ? String(s.standardScore) : "",
      percentile: s.percentile != null ? String(s.percentile) : "",
      grade: s.grade != null ? String(s.grade) : "",
      maxRawScore: String(s.maxRawScore),
      wrongNumbers: wrongNums,
      myAnswers: {},
      gradeResults: null,
      answerKeyCount: "",
      answerKey: {},
      timings,
      expanded: true,
    };
  });
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export function ExamNewClient({ units, initialExam }: { units: Unit[]; initialExam?: ExamRecord }) {
  const router = useRouter();
  const isEdit = !!initialExam;

  // edit 모드일 때 초기값 추출
  function parseExamDate(dateStr: string) {
    const d = new Date(dateStr);
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  }
  function guessYear(exam: ExamRecord) {
    const { month, year } = parseExamDate(exam.date);
    // 평가원은 학년도 = 실제연도+1 (6월/9월), 학년도 = 실제연도+1 (11월)
    if (exam.type === "평가원") return year + 1;
    return year;
  }
  function guessMonth(exam: ExamRecord) {
    return parseExamDate(exam.date).month;
  }

  const [examType, setExamType] = useState<ExamType | "">(isEdit ? (initialExam.type as ExamType) : "");
  const [year, setYear] = useState<number | null>(isEdit ? guessYear(initialExam) : null);
  const [month, setMonth] = useState<number | null>(isEdit ? guessMonth(initialExam) : null);
  const [subjects, setSubjects] = useState<SubjectInput[]>(isEdit ? examToSubjectInputs(initialExam) : []);
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // exam_data.json 로드
  useEffect(() => {
    fetch("/exam_data.json")
      .then((r) => r.json())
      .then(setExamData)
      .catch(() => {});
  }, []);

  const examInfo = useMemo(() => buildExamInfo(examType, year, month), [examType, year, month]);
  const examEntry = useMemo(
    () => (examType && year && month ? findExamEntry(examData, year, month, examType as ExamType) : null),
    [examData, examType, year, month]
  );

  const availableMonths = examType ? MONTHS_BY_TYPE[examType as ExamType] : [];

  function handleTypeSelect(t: ExamType) { setExamType(t); setMonth(null); }
  function handleYearSelect(y: number) { setYear(y); setMonth(null); }

  // 과목 관리
  function addSubject(name: string) {
    if (name !== "탐구" && subjects.find((s) => s.name === name)) return;
    if (name === "탐구" && subjects.filter((s) => s.name === "탐구").length >= 2) return;
    setSubjects((p) => [...p, defaultSubject(name)]);
  }
  function removeSubject(idx: number) { setSubjects((p) => p.filter((_, i) => i !== idx)); }
  function updateSubject(idx: number, patch: Partial<SubjectInput>) {
    setSubjects((p) => p.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  // 자동채점 실행
  function runGrade(subIdx: number) {
    const sub = subjects[subIdx];
    const subEntry = findSubjectEntry(examEntry, sub.name, sub.optionName);
    if (!subEntry) return;

    const results: GradeResult[] = subEntry.questions.map((q) => {
      const correct = q.answer ?? "";
      const mine = sub.myAnswers[String(q.number)] ?? "";
      const isCorrect = correct !== "" && mine !== "" && correct === mine;
      return { number: q.number, correct, mine, isCorrect, score: q.score };
    });

    const rawScore = results.reduce((s, r) => s + (r.isCorrect ? r.score : 0), 0);
    updateSubject(subIdx, {
      gradeResults: results,
      rawScore: String(rawScore),
    });
  }

  // 제출
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!examInfo) { setError("기관·연도·월을 선택해주세요."); return; }
    if (subjects.length === 0) { setError("과목을 1개 이상 추가해주세요."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/exams/${initialExam!.id}` : "/api/exams", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: examInfo.name,
          date: examInfo.date,
          type: examType,
          grade: "",
          subjects: subjects.map((s) => {
            const subEntry = findSubjectEntry(examEntry, s.name, s.optionName);
            // 오답 문항 목록 구성
            let questions: object[] = [];
            if (subEntry && s.gradeResults) {
              questions = s.gradeResults
                .filter((r) => !r.isCorrect && r.mine !== "")
                .map((r) => ({
                  number: r.number,
                  unit: "",
                  difficulty: "중",
                  isCorrect: false,
                  wrongType: null,
                  memo: null,
                }));
            } else {
              questions = s.wrongNumbers
                .split(/[,\s]+/)
                .map((n) => n.trim())
                .filter((n) => /^\d+$/.test(n))
                .map((n) => ({
                  number: Number(n),
                  unit: "",
                  difficulty: "중",
                  isCorrect: false,
                }));
            }
            const notes =
              s.name === "국어" && (s.timings.hwajak || s.timings.munhak || s.timings.dokso)
                ? JSON.stringify({ timings: s.timings })
                : null;
            return {
              name: s.name,
              optionName: s.optionName || null,
              rawScore: s.rawScore ? Number(s.rawScore) : null,
              standardScore: s.standardScore ? Number(s.standardScore) : null,
              percentile: s.percentile ? Number(s.percentile) : null,
              grade: s.grade ? Number(s.grade) : null,
              maxRawScore: Number(s.maxRawScore) || 100,
              notes,
              questions,
            };
          }),
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      const exam = await res.json();

      // 정답지 저장 (수동 입력된 과목만)
      const keyPromises = subjects
        .filter((s) => {
          const count = Number(s.answerKeyCount);
          return count > 0 && Object.keys(s.answerKey).length > 0;
        })
        .map((s) =>
          fetch("/api/answer-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              examId: exam.id,
              subjectName: s.name,
              optionName: s.optionName || null,
              answers: s.answerKey,
              scores: null,
              totalCount: Number(s.answerKeyCount),
            }),
          })
        );
      await Promise.all(keyPromises);

      router.push("/");
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" };
  const labelStyle = { color: "var(--muted-foreground)", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.03em" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">{isEdit ? "모의고사 수정" : "모의고사 입력"}</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          {isEdit ? initialExam!.name : "선택하면 자동 완성됩니다."}
        </p>
      </div>

      {/* ── 기관 / 연도 / 월 가로 배치 ── */}
      <div
        className="rounded-2xl border p-5 grid grid-cols-3 gap-6"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* 기관 */}
        <div className="space-y-2">
          <p style={labelStyle}>기관</p>
          <div className="flex flex-col gap-1.5">
            {TYPES.map((t) => (
              <Chip key={t} label={t} size="md" selected={examType === t} onClick={() => handleTypeSelect(t)} />
            ))}
          </div>
        </div>

        {/* 연도 */}
        <div className="space-y-2">
          <p style={labelStyle}>{examType === "평가원" ? "학년도" : "연도"}</p>
          <div className="flex flex-col gap-1.5">
            {YEARS.map((y) => (
              <Chip
                key={y}
                label={String(y)}
                size="md"
                selected={year === y}
                onClick={() => handleYearSelect(y)}
              />
            ))}
          </div>
        </div>

        {/* 월 */}
        <div className="space-y-2">
          <p style={labelStyle}>월</p>
          {examType ? (
            <div className="flex flex-col gap-1.5">
              {availableMonths.map((m) => (
                <Chip
                  key={m}
                  label={examType === "평가원" && m === 11 ? "11월 수능" : `${m}월`}
                  size="md"
                  selected={month === m}
                  onClick={() => setMonth(m)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>기관 먼저 선택</p>
          )}
        </div>
      </div>

      {/* 시험명 미리보기 */}
      {examInfo && (
        <div
          className="rounded-2xl px-5 py-3.5 flex items-center justify-between"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <div className="flex items-center gap-2">
            {examEntry && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(255,255,255,0.2)" }}>
                <Zap size={10} /> 자동채점 가능
              </span>
            )}
            <p className="font-bold">{examInfo.name}</p>
          </div>
          <p className="text-sm opacity-70">{examInfo.date}</p>
        </div>
      )}

      {/* ── 과목 추가 ── */}
      {examInfo && (
        <>
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <p style={labelStyle}>과목 추가</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SUBJECT_OPTIONS).map((sub) => {
                const count = subjects.filter((s) => s.name === sub).length;
                const maxed = sub === "탐구" ? count >= 2 : count >= 1;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      if (sub === "탐구") {
                        if (!maxed) addSubject(sub);
                      } else {
                        if (count > 0) removeSubject(subjects.findIndex((s) => s.name === sub));
                        else addSubject(sub);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full text-sm border font-medium transition-all"
                    style={{
                      borderColor: count > 0 ? "var(--primary)" : "var(--border)",
                      background: count > 0 ? "var(--primary)" : "transparent",
                      color: count > 0 ? "var(--primary-foreground)" : "var(--foreground)",
                    }}
                  >
                    {sub === "탐구"
                      ? count === 0 ? `+ ${sub}` : count === 1 ? `✓ ${sub} (1) +` : `✓ ${sub} (2)`
                      : count > 0 ? `✓ ${sub}` : `+ ${sub}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 각 과목 카드 ── */}
          {subjects.map((sub, subIdx) => {
            const subEntry = findSubjectEntry(examEntry, sub.name, sub.optionName);
            const hasAutoGrade = !!subEntry;
            const graded = !!sub.gradeResults;
            const correctCount = sub.gradeResults?.filter((r) => r.isCorrect).length ?? 0;
            const totalQ = subEntry?.questions.length ?? 0;
            const rawFromGrade = sub.gradeResults?.reduce((s, r) => s + (r.isCorrect ? r.score : 0), 0) ?? 0;

            return (
              <div
                key={subIdx}
                className="rounded-2xl border overflow-hidden"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* 헤더 */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
                  onClick={() => updateSubject(subIdx, { expanded: !sub.expanded })}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{sub.name}</span>
                    {sub.optionName && <Badge variant="secondary">{sub.optionName}</Badge>}
                    {hasAutoGrade && (
                      <span className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                        <Zap size={10} /> 자동채점
                      </span>
                    )}
                    {graded && (
                      <span className="text-xs font-bold" style={{ color: "#10b981" }}>
                        {rawFromGrade}점 ({correctCount}/{totalQ})
                      </span>
                    )}
                    {sub.grade && <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: "var(--primary)" }}>{sub.grade}등급</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeSubject(subIdx); }}>
                      <Trash2 size={14} style={{ color: "var(--destructive)" }} />
                    </button>
                    {sub.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {sub.expanded && (
                  <div className="border-t px-5 pb-5 space-y-5 pt-4" style={{ borderColor: "var(--border)" }}>

                    {/* 선택과목 */}
                    {SUBJECT_OPTIONS[sub.name]?.length > 1 && (
                      <div className="space-y-2">
                        <p style={labelStyle}>선택과목</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SUBJECT_OPTIONS[sub.name].map((opt) => (
                            <Chip key={opt} label={opt} size="sm" selected={sub.optionName === opt}
                              onClick={() => updateSubject(subIdx, { optionName: opt, myAnswers: {}, gradeResults: null })} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── 자동채점 (exam_data.json 있을 때) ── */}
                    {hasAutoGrade && subEntry && (
                      <div className="space-y-3">
                        <p style={labelStyle}>내 답 입력 (자동채점)</p>

                        {/* 정답 & 내 답 그리드 */}
                        <div className="space-y-2">
                          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>정답</p>
                          <div className="flex flex-wrap gap-1.5">
                            {subEntry.questions.map((q) => (
                              <AnswerCell key={q.number} num={q.number} value={q.answer ?? "?"} readOnly highlight="correct-answer" />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>내 답</p>
                          <div className="answer-cells flex flex-wrap gap-1.5">
                            {subEntry.questions.map((q) => {
                              const gr = sub.gradeResults?.find((r) => r.number === q.number);
                              return (
                                <AnswerCell
                                  key={q.number}
                                  num={q.number}
                                  value={sub.myAnswers[String(q.number)] ?? ""}
                                  onChange={(v) =>
                                    updateSubject(subIdx, {
                                      myAnswers: { ...sub.myAnswers, [String(q.number)]: v },
                                      gradeResults: null,
                                    })
                                  }
                                  highlight={gr ? (gr.isCorrect ? "correct" : "wrong") : undefined}
                                  autoAdvance
                                />
                              );
                            })}
                          </div>
                        </div>

                        <Button type="button" size="sm" onClick={() => runGrade(subIdx)}>
                          <CheckCircle2 size={13} className="mr-1" /> 채점하기
                        </Button>

                        {/* 채점 결과 */}
                        {sub.gradeResults && (
                          <div className="rounded-xl p-3 space-y-1" style={{ background: "var(--muted)" }}>
                            <p className="text-sm font-bold">
                              {rawFromGrade}점 · {correctCount}/{totalQ} 정답
                            </p>
                            {sub.gradeResults.filter((r) => !r.isCorrect && r.mine !== "").length > 0 && (
                              <p className="text-xs" style={{ color: "var(--destructive)" }}>
                                오답: {sub.gradeResults.filter((r) => !r.isCorrect && r.mine !== "").map((r) => `${r.number}번`).join(", ")}
                              </p>
                            )}
                            {/* 등급컷 대조 */}
                            {subEntry.cutoffs && (
                              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                                {Object.entries(subEntry.cutoffs)
                                  .filter(([, v]) => v.rawScore !== undefined)
                                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                                  .map(([g, v]) => `${g}등급 ${v.rawScore}점`)
                                  .join(" / ")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── 수동 점수 입력 ── */}
                    <div className="space-y-2">
                      <p style={labelStyle}>성적 {hasAutoGrade ? "(채점 후 자동 입력)" : ""}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "원점수", key: "rawScore", ph: "0" },
                          { label: "표점", key: "standardScore", ph: "0" },
                          { label: "백분위", key: "percentile", ph: "0.0" },
                          { label: "등급", key: "grade", ph: "1~9" },
                        ].map(({ label, key, ph }) => (
                          <div key={key} className="space-y-1">
                            <p style={{ ...labelStyle, fontSize: "0.65rem" }}>{label}</p>
                            <Input
                              type="number"
                              value={(sub as unknown as Record<string, string>)[key]}
                              onChange={(e) => updateSubject(subIdx, { [key]: e.target.value })}
                              placeholder={ph}
                              style={inputStyle}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── 정답지 입력 (수동 모드만) ── */}
                    {!hasAutoGrade && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <p style={labelStyle}>정답지 입력</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>총 문항 수</span>
                            <Input
                              type="number"
                              value={sub.answerKeyCount}
                              onChange={(e) => {
                                const count = Number(e.target.value);
                                // 문항 수 변경 시 초과된 답안 정리
                                const newKey = Object.fromEntries(
                                  Object.entries(sub.answerKey).filter(([k]) => Number(k) <= count)
                                );
                                updateSubject(subIdx, { answerKeyCount: e.target.value, answerKey: newKey });
                              }}
                              placeholder="45"
                              style={{ ...inputStyle, width: "4rem" }}
                            />
                          </div>
                        </div>
                        {Number(sub.answerKeyCount) > 0 && (
                          <div className="answer-cells flex flex-wrap gap-1.5">
                            {Array.from({ length: Number(sub.answerKeyCount) }, (_, i) => i + 1).map((n) => (
                              <AnswerCell
                                key={n}
                                num={n}
                                value={sub.answerKey[String(n)] ?? ""}
                                onChange={(v) =>
                                  updateSubject(subIdx, { answerKey: { ...sub.answerKey, [String(n)]: v } })
                                }
                                autoAdvance
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── 오답 번호 (수동 모드만) ── */}
                    {!hasAutoGrade && (
                      <div className="space-y-2">
                        <p style={labelStyle}>오답 문항 번호</p>
                        <Input
                          value={sub.wrongNumbers}
                          onChange={(e) => updateSubject(subIdx, { wrongNumbers: e.target.value })}
                          placeholder="예: 3, 7, 15, 29"
                          style={inputStyle}
                        />
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>쉼표로 구분해서 입력</p>
                      </div>
                    )}

                    {/* ── 국어 시간 기록 ── */}
                    {sub.name === "국어" && (
                      <div className="space-y-2">
                        <p style={labelStyle}>영역별 소요시간 (분)</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(["hwajak", "munhak", "dokso"] as const).map((key) => {
                            const labels = { hwajak: "화법·작문", munhak: "문학", dokso: "독서" };
                            return (
                              <div key={key} className="space-y-1">
                                <p style={{ ...labelStyle, fontSize: "0.65rem" }}>{labels[key]}</p>
                                <Input
                                  type="number"
                                  value={sub.timings[key]}
                                  onChange={(e) =>
                                    updateSubject(subIdx, { timings: { ...sub.timings, [key]: e.target.value } })
                                  }
                                  placeholder="0"
                                  style={inputStyle}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

      {/* 하단 고정 저장 버튼 */}
      {examInfo && (
        <div
          className="fixed bottom-0 left-56 right-0 px-6 py-4 z-50 flex items-center justify-between gap-4"
          style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
            {subjects.length === 0 ? "과목을 추가해주세요" : `${subjects.length}개 과목`}
          </p>
          <Button
            type="submit"
            disabled={submitting || subjects.length === 0}
            className="rounded-xl px-8 py-2"
          >
            {submitting ? "저장 중..." : isEdit ? "수정 완료" : `${examInfo.name} 저장`}
          </Button>
        </div>
      )}

      {/* 고정 버튼 공간 확보 */}
      {examInfo && <div className="h-20" />}
    </form>
  );
}
