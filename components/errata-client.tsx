"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown, AlertCircle, CheckCircle2, BookOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Exam = {
  id: string;
  name: string;
  date: string | Date;
  type: string;
  subjects: { name: string; optionName: string | null }[];
};

type ErrataItem = {
  id: string;
  examId: string;
  subjectName: string | null;
  questionNumber: number | null;
  errataType: string;
  before: string | null;
  after: string | null;
  description: string;
  isOfficial: boolean;
  createdAt: string;
  exam: { name: string };
};

const ERRATA_TYPES = [
  { key: "오탈자", color: "#f59e0b", icon: "✏️" },
  { key: "오류",   color: "#ef4444", icon: "❌" },
  { key: "보충",   color: "#3b82f6", icon: "📝" },
  { key: "기타",   color: "#94a3b8", icon: "💬" },
];

function typeColor(t: string) {
  return ERRATA_TYPES.find((x) => x.key === t)?.color ?? "#94a3b8";
}
function typeIcon(t: string) {
  return ERRATA_TYPES.find((x) => x.key === t)?.icon ?? "💬";
}

const inputStyle = {
  background: "var(--muted)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};

export function ErrataClient({ exams }: { exams: Exam[] }) {
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [errata, setErrata] = useState<ErrataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // 폼 상태
  const [fSubject, setFSubject] = useState("");
  const [fQNum, setFQNum] = useState("");
  const [fType, setFType] = useState("오탈자");
  const [fBefore, setFBefore] = useState("");
  const [fAfter, setFAfter] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fOfficial, setFOfficial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  // 정오표 불러오기
  const fetchErrata = useCallback(async (examId: string) => {
    setLoading(true);
    const res = await fetch(`/api/errata?examId=${examId}`);
    const data = await res.json();
    setErrata(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedExamId) fetchErrata(selectedExamId);
    else setErrata([]);
  }, [selectedExamId, fetchErrata]);

  // 폼 초기화
  function resetForm() {
    setFSubject(""); setFQNum(""); setFType("오탈자");
    setFBefore(""); setFAfter(""); setFDesc(""); setFOfficial(false);
    setFormError("");
  }

  // 정오표 추가
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExamId) { setFormError("시험을 먼저 선택해주세요."); return; }
    if (!fDesc.trim()) { setFormError("설명을 입력해주세요."); return; }
    setSubmitting(true);
    setFormError("");

    const res = await fetch("/api/errata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId: selectedExamId,
        subjectName: fSubject || null,
        questionNumber: fQNum ? Number(fQNum) : null,
        errataType: fType,
        before: fBefore || null,
        after: fAfter || null,
        description: fDesc,
        isOfficial: fOfficial,
      }),
    });

    if (res.ok) {
      const item = await res.json();
      setErrata((prev) => [{ ...item, exam: { name: selectedExam!.name } }, ...prev]);
      resetForm();
      setShowForm(false);
    } else {
      setFormError("저장 실패");
    }
    setSubmitting(false);
  }

  // 삭제
  async function handleDelete(id: string) {
    if (!confirm("이 정오표를 삭제할까요?")) return;
    await fetch(`/api/errata?id=${id}`, { method: "DELETE" });
    setErrata((prev) => prev.filter((e) => e.id !== id));
  }

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };
  const labelStyle = { color: "var(--muted-foreground)", fontSize: "0.75rem", fontWeight: 500 } as const;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">정오표</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            모의고사별 오류·수정 사항을 기록하세요.
          </p>
        </div>
        {selectedExamId && (
          <Button onClick={() => { setShowForm((v) => !v); resetForm(); }}>
            <Plus size={15} className="mr-1" />
            정오표 추가
          </Button>
        )}
      </div>

      {/* 시험 선택 */}
      <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <p className="text-sm font-semibold">모의고사 선택</p>
        {exams.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            입력된 모의고사가 없습니다. 먼저 모의고사를 입력해주세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {exams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => { setSelectedExamId(exam.id); setShowForm(false); }}
                className="flex items-start gap-3 rounded-lg border p-3 text-left transition-all"
                style={{
                  borderColor: selectedExamId === exam.id ? "var(--primary)" : "var(--border)",
                  background: selectedExamId === exam.id
                    ? "color-mix(in srgb, var(--primary) 10%, var(--card))"
                    : "var(--muted)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{exam.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(exam.date).toLocaleDateString("ko-KR")} · {exam.type}
                  </p>
                </div>
                {selectedExamId === exam.id && (
                  <CheckCircle2 size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 정오표 입력 폼 */}
      {showForm && selectedExam && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border p-5 space-y-4"
          style={{ ...cardStyle, borderColor: "var(--primary)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
            새 정오표 — {selectedExam.name}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* 과목 */}
            <div className="space-y-1">
              <label style={labelStyle}>과목 (선택)</label>
              <select
                value={fSubject}
                onChange={(e) => setFSubject(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value="">전체</option>
                {[...new Map(
                  selectedExam.subjects.map((s) => [s.name, s])
                ).values()].map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}{s.optionName ? ` (${s.optionName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 문항 번호 */}
            <div className="space-y-1">
              <label style={labelStyle}>문항 번호 (선택)</label>
              <Input
                type="number"
                min={1}
                value={fQNum}
                onChange={(e) => setFQNum(e.target.value)}
                placeholder="예: 15"
                style={inputStyle}
              />
            </div>
          </div>

          {/* 유형 */}
          <div className="space-y-1">
            <label style={labelStyle}>정오표 유형</label>
            <div className="flex gap-2 flex-wrap">
              {ERRATA_TYPES.map(({ key, color, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFType(key)}
                  className="px-3 py-1.5 rounded-full text-sm border flex items-center gap-1"
                  style={{
                    borderColor: fType === key ? color : "var(--border)",
                    background: fType === key ? color : "transparent",
                    color: fType === key ? "#fff" : "var(--foreground)",
                  }}
                >
                  {icon} {key}
                </button>
              ))}
            </div>
          </div>

          {/* 수정 전/후 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label style={labelStyle}>수정 전 (선택)</label>
              <Textarea
                value={fBefore}
                onChange={(e) => setFBefore(e.target.value)}
                placeholder="원래 내용..."
                rows={2}
                style={{ ...inputStyle, fontSize: "0.8rem" }}
              />
            </div>
            <div className="space-y-1">
              <label style={labelStyle}>수정 후 (선택)</label>
              <Textarea
                value={fAfter}
                onChange={(e) => setFAfter(e.target.value)}
                placeholder="정정된 내용..."
                rows={2}
                style={{ ...inputStyle, fontSize: "0.8rem" }}
              />
            </div>
          </div>

          {/* 설명 */}
          <div className="space-y-1">
            <label style={labelStyle}>설명 *</label>
            <Textarea
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              placeholder="정오표 내용을 설명해주세요."
              rows={3}
              style={inputStyle}
            />
          </div>

          {/* 공식 여부 */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={fOfficial}
              onChange={(e) => setFOfficial(e.target.checked)}
              className="rounded"
            />
            공식 정오표 (평가원·교육청 발표)
          </label>

          {formError && (
            <p className="text-sm" style={{ color: "var(--destructive)" }}>{formError}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowForm(false); resetForm(); }}
            >
              취소
            </Button>
          </div>
        </form>
      )}

      {/* 정오표 목록 */}
      {selectedExamId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {selectedExam?.name} 정오표
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>
                {errata.length}건
              </span>
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border p-8 text-center" style={cardStyle}>
              <p style={{ color: "var(--muted-foreground)" }}>불러오는 중...</p>
            </div>
          ) : errata.length === 0 ? (
            <div className="rounded-xl border p-10 text-center" style={cardStyle}>
              <BookOpen size={32} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
              <p className="font-medium">정오표가 없습니다</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                위 &apos;정오표 추가&apos; 버튼을 눌러 작성하세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {errata.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border p-4 space-y-2"
                  style={{
                    ...cardStyle,
                    borderLeftWidth: 4,
                    borderLeftColor: typeColor(item.errataType),
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{typeIcon(item.errataType)}</span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: typeColor(item.errataType) }}
                      >
                        {item.errataType}
                      </span>
                      {item.isOfficial && (
                        <Badge variant="outline" style={{ fontSize: "0.65rem", color: "var(--primary)", borderColor: "var(--primary)" }}>
                          공식
                        </Badge>
                      )}
                      {item.subjectName && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                          {item.subjectName}
                        </span>
                      )}
                      {item.questionNumber && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                          {item.questionNumber}번
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded flex-shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* 수정 전/후 */}
                  {(item.before || item.after) && (
                    <div className="flex items-start gap-2 text-sm">
                      {item.before && (
                        <div className="flex-1 rounded p-2" style={{ background: "rgba(239,68,68,0.08)" }}>
                          <p className="text-xs mb-1" style={{ color: "#ef4444" }}>수정 전</p>
                          <p style={{ color: "var(--foreground)" }}>{item.before}</p>
                        </div>
                      )}
                      {item.before && item.after && (
                        <span className="mt-4 text-lg" style={{ color: "var(--muted-foreground)" }}>→</span>
                      )}
                      {item.after && (
                        <div className="flex-1 rounded p-2" style={{ background: "rgba(16,185,129,0.08)" }}>
                          <p className="text-xs mb-1" style={{ color: "#10b981" }}>수정 후</p>
                          <p style={{ color: "var(--foreground)" }}>{item.after}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-sm" style={{ color: "var(--foreground)" }}>{item.description}</p>

                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(item.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
