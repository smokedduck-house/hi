"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Unit = { id: string; subjectName: string; optionName: string | null; name: string };

type QuestionInput = {
  number: string;
  unit: string;
  topic: string;
  difficulty: "상" | "중" | "하";
  isCorrect: boolean;
  wrongType: string;
  memo: string;
};

type SubjectInput = {
  name: string;
  optionName: string;
  rawScore: string;
  standardScore: string;
  percentile: string;
  grade: string;
  maxRawScore: string;
  questions: QuestionInput[];
  expanded: boolean;
};

const SUBJECT_OPTIONS: Record<string, string[]> = {
  국어: ["공통", "언어와매체", "화법과작문"],
  수학: ["공통", "미적분", "확률과통계", "기하"],
  영어: ["공통"],
  한국사: ["공통"],
  사탐: ["생활과윤리", "윤리와사상", "한국지리", "세계지리", "동아시아사", "세계사", "경제", "정치와법", "사회문화"],
  과탐: ["물리학I", "물리학II", "화학I", "화학II", "생명과학I", "생명과학II", "지구과학I", "지구과학II"],
};

const WRONG_TYPES = ["개념부족", "실수", "시간부족", "문제이해실패"];
const DIFFICULTIES = ["상", "중", "하"] as const;

function defaultSubject(name: string): SubjectInput {
  return {
    name,
    optionName: "",
    rawScore: "",
    standardScore: "",
    percentile: "",
    grade: "",
    maxRawScore: name === "탐구1" || name === "탐구2" ? "50" : "100",
    questions: [],
    expanded: true,
  };
}

function defaultQuestion(): QuestionInput {
  return { number: "", unit: "", topic: "", difficulty: "중", isCorrect: false, wrongType: "", memo: "" };
}

export function ExamNewClient({ units }: { units: Unit[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("평가원");
  const [grade, setGrade] = useState("고3");
  const [subjects, setSubjects] = useState<SubjectInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addSubject(subName: string) {
    if (subjects.find((s) => s.name === subName)) return;
    setSubjects((prev) => [...prev, defaultSubject(subName)]);
  }

  function removeSubject(idx: number) {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSubject(idx: number, patch: Partial<SubjectInput>) {
    setSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addQuestion(subIdx: number) {
    setSubjects((prev) =>
      prev.map((s, i) => (i === subIdx ? { ...s, questions: [...s.questions, defaultQuestion()] } : s))
    );
  }

  function removeQuestion(subIdx: number, qIdx: number) {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === subIdx ? { ...s, questions: s.questions.filter((_, qi) => qi !== qIdx) } : s
      )
    );
  }

  function updateQuestion(subIdx: number, qIdx: number, patch: Partial<QuestionInput>) {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === subIdx
          ? { ...s, questions: s.questions.map((q, qi) => (qi === qIdx ? { ...q, ...patch } : q)) }
          : s
      )
    );
  }

  function getUnitsForSubject(sub: SubjectInput) {
    return units.filter(
      (u) =>
        u.subjectName === sub.name &&
        (u.optionName === null || u.optionName === sub.optionName || sub.optionName === "공통" || sub.optionName === "")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || !date) { setError("시험명과 날짜를 입력해주세요."); return; }
    if (subjects.length === 0) { setError("과목을 1개 이상 추가해주세요."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, date, type, grade,
          subjects: subjects.map((s) => ({
            name: s.name,
            optionName: s.optionName || null,
            rawScore: s.rawScore ? Number(s.rawScore) : null,
            standardScore: s.standardScore ? Number(s.standardScore) : null,
            percentile: s.percentile ? Number(s.percentile) : null,
            grade: s.grade ? Number(s.grade) : null,
            maxRawScore: Number(s.maxRawScore) || 100,
            questions: s.questions
              .filter((q) => q.number)
              .map((q) => ({
                number: Number(q.number),
                unit: q.unit,
                topic: q.topic || null,
                difficulty: q.difficulty,
                isCorrect: q.isCorrect,
                wrongType: q.wrongType || null,
                memo: q.memo || null,
              })),
          })),
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      router.push("/");
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };
  const inputStyle = {
    background: "var(--muted)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };
  const labelStyle = { color: "var(--muted-foreground)", fontSize: "0.75rem", fontWeight: 500 };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">모의고사 입력</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          회차 정보와 과목별 성적·오답을 입력하세요.
        </p>
      </div>

      {/* 회차 정보 */}
      <div className="rounded-xl border p-5 space-y-4" style={cardStyle}>
        <h3 className="font-semibold">회차 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <label style={labelStyle}>시험명</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2025학년도 6월 모의평가"
              style={inputStyle}
            />
          </div>
          <div className="space-y-1">
            <label style={labelStyle}>날짜</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label style={labelStyle}>학년</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={inputStyle}
            >
              {["고1", "고2", "고3", "N수"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label style={labelStyle}>시험 종류</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={inputStyle}
            >
              {["평가원", "교육청", "사설"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 과목 추가 */}
      <div className="rounded-xl border p-5 space-y-3" style={cardStyle}>
        <h3 className="font-semibold">과목 추가</h3>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SUBJECT_OPTIONS).map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => addSubject(sub)}
              className="px-3 py-1 rounded-full text-sm border transition-colors"
              style={{
                borderColor: subjects.find((s) => s.name === sub) ? "var(--primary)" : "var(--border)",
                background: subjects.find((s) => s.name === sub) ? "var(--primary)" : "transparent",
                color: subjects.find((s) => s.name === sub) ? "var(--primary-foreground)" : "var(--foreground)",
              }}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* 각 과목 입력 */}
      {subjects.map((sub, subIdx) => {
        const availableUnits = getUnitsForSubject(sub);
        return (
          <div key={subIdx} className="rounded-xl border" style={cardStyle}>
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer"
              onClick={() => updateSubject(subIdx, { expanded: !sub.expanded })}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{sub.name}</h3>
                {sub.optionName && <Badge variant="secondary">{sub.optionName}</Badge>}
                {sub.grade && (
                  <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ background: "#3b82f6" }}>
                    {sub.grade}등급
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeSubject(subIdx); }}
                  className="p-1 rounded hover:bg-red-50"
                >
                  <Trash2 size={14} style={{ color: "var(--destructive)" }} />
                </button>
                {sub.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {sub.expanded && (
              <div className="px-5 pb-5 space-y-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                {/* 선택과목 */}
                {SUBJECT_OPTIONS[sub.name] && SUBJECT_OPTIONS[sub.name].length > 1 && (
                  <div className="space-y-1">
                    <label style={labelStyle}>선택과목</label>
                    <select
                      value={sub.optionName}
                      onChange={(e) => updateSubject(subIdx, { optionName: e.target.value, questions: [] })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      style={inputStyle}
                    >
                      <option value="">선택...</option>
                      {SUBJECT_OPTIONS[sub.name].map((opt) => <option key={opt}>{opt}</option>)}
                    </select>
                  </div>
                )}

                {/* 성적 입력 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "원점수", key: "rawScore", placeholder: "0" },
                    { label: "표준점수", key: "standardScore", placeholder: "0" },
                    { label: "백분위", key: "percentile", placeholder: "0.0" },
                    { label: "등급", key: "grade", placeholder: "1~9" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label style={labelStyle}>{label}</label>
                      <Input
                        type="number"
                        value={(sub as unknown as Record<string, string>)[key]}
                        onChange={(e) => updateSubject(subIdx, { [key]: e.target.value })}
                        placeholder={placeholder}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>

                {/* 오답 문항 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label style={labelStyle}>오답 문항 ({sub.questions.filter((q) => !q.isCorrect).length}개)</label>
                    <button
                      type="button"
                      onClick={() => addQuestion(subIdx)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                      style={{ background: "var(--muted)", color: "var(--foreground)" }}
                    >
                      <Plus size={12} /> 문항 추가
                    </button>
                  </div>

                  {sub.questions.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      className="rounded-lg border p-3 space-y-2"
                      style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-16">
                          <Input
                            type="number"
                            value={q.number}
                            onChange={(e) => updateQuestion(subIdx, qIdx, { number: e.target.value })}
                            placeholder="번호"
                            style={inputStyle}
                          />
                        </div>
                        <select
                          value={q.unit}
                          onChange={(e) => updateQuestion(subIdx, qIdx, { unit: e.target.value })}
                          className="flex-1 rounded-md border px-2 py-2 text-sm min-w-32"
                          style={inputStyle}
                        >
                          <option value="">단원 선택</option>
                          {availableUnits.map((u) => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                        <select
                          value={q.difficulty}
                          onChange={(e) => updateQuestion(subIdx, qIdx, { difficulty: e.target.value as "상" | "중" | "하" })}
                          className="w-16 rounded-md border px-2 py-2 text-sm"
                          style={inputStyle}
                        >
                          {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.isCorrect}
                            onChange={(e) => updateQuestion(subIdx, qIdx, { isCorrect: e.target.checked })}
                          />
                          맞음
                        </label>
                        <button
                          type="button"
                          onClick={() => removeQuestion(subIdx, qIdx)}
                        >
                          <Trash2 size={13} style={{ color: "var(--destructive)" }} />
                        </button>
                      </div>
                      {!q.isCorrect && (
                        <div className="flex gap-2 flex-wrap">
                          {WRONG_TYPES.map((wt) => (
                            <button
                              key={wt}
                              type="button"
                              onClick={() => updateQuestion(subIdx, qIdx, { wrongType: q.wrongType === wt ? "" : wt })}
                              className="text-xs px-2 py-0.5 rounded-full border"
                              style={{
                                background: q.wrongType === wt ? "var(--primary)" : "transparent",
                                color: q.wrongType === wt ? "var(--primary-foreground)" : "var(--foreground)",
                                borderColor: q.wrongType === wt ? "var(--primary)" : "var(--border)",
                              }}
                            >
                              {wt}
                            </button>
                          ))}
                        </div>
                      )}
                      <Textarea
                        value={q.memo}
                        onChange={(e) => updateQuestion(subIdx, qIdx, { memo: e.target.value })}
                        placeholder="분석 메모 (선택)"
                        rows={2}
                        style={{ ...inputStyle, fontSize: "0.75rem" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "저장 중..." : "모의고사 저장"}
      </Button>
    </form>
  );
}
