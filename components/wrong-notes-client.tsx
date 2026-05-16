"use client";

import { useState, useMemo } from "react";
import { Bookmark, BookmarkCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Question = {
  id: string;
  number: number;
  unit: string;
  topic: string | null;
  difficulty: string;
  isCorrect: boolean;
  wrongType: string | null;
  memo: string | null;
  isBookmarked: boolean;
  subject: {
    name: string;
    optionName: string | null;
    exam: { name: string; date: string | Date };
  };
};

type Unit = { id: string; subjectName: string; name: string };

const WRONG_TYPE_COLORS: Record<string, string> = {
  개념부족: "#ef4444",
  실수: "#f59e0b",
  시간부족: "#3b82f6",
  문제이해실패: "#8b5cf6",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  상: "#ef4444",
  중: "#f59e0b",
  하: "#10b981",
};

export function WrongNotesClient({ questions: initialQuestions, units }: { questions: Question[]; units: Unit[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterWrongType, setFilterWrongType] = useState("");
  const [filterBookmark, setFilterBookmark] = useState(false);

  const subjects = [...new Set(questions.map((q) => q.subject.name))];
  const wrongTypes = [...new Set(questions.map((q) => q.wrongType).filter(Boolean))] as string[];

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterSubject && q.subject.name !== filterSubject) return false;
      if (filterWrongType && q.wrongType !== filterWrongType) return false;
      if (filterBookmark && !q.isBookmarked) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!q.unit.toLowerCase().includes(s) && !(q.memo ?? "").toLowerCase().includes(s) && !(q.topic ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [questions, filterSubject, filterWrongType, filterBookmark, search]);

  async function toggleBookmark(id: string) {
    const q = questions.find((q) => q.id === id);
    if (!q) return;
    const newVal = !q.isBookmarked;
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isBookmarked: newVal } : q)));
    await fetch("/api/wrong-notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isBookmarked: newVal }),
    });
  }

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">오답 노트</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          총 {questions.length}개 오답 · 표시 중 {filtered.length}개
        </p>
      </div>

      {/* 필터 바 */}
      <div className="rounded-xl border p-4 flex flex-wrap gap-3 items-center" style={cardStyle}>
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="단원, 메모, 주제 검색..."
            className="pl-8"
            style={{ background: "var(--muted)", borderColor: "var(--border)" }}
          />
        </div>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="">모든 과목</option>
          {subjects.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={filterWrongType}
          onChange={(e) => setFilterWrongType(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="">모든 오답유형</option>
          {wrongTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setFilterBookmark((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm"
          style={{
            background: filterBookmark ? "var(--primary)" : "var(--muted)",
            borderColor: filterBookmark ? "var(--primary)" : "var(--border)",
            color: filterBookmark ? "var(--primary-foreground)" : "var(--foreground)",
          }}
        >
          <BookmarkCheck size={14} />
          즐겨찾기만
        </button>
      </div>

      {/* 오답 카드 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={cardStyle}>
          <p style={{ color: "var(--muted-foreground)" }}>
            {questions.length === 0 ? "아직 오답이 없습니다. 모의고사를 입력해보세요!" : "조건에 맞는 오답이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((q) => (
            <div key={q.id} className="rounded-xl border p-4 space-y-2.5 relative" style={cardStyle}>
              <button
                onClick={() => toggleBookmark(q.id)}
                className="absolute top-3 right-3"
                style={{ color: q.isBookmarked ? "#f59e0b" : "var(--muted-foreground)" }}
              >
                {q.isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </button>

              <div className="flex items-start gap-2 pr-6">
                <span
                  className="font-bold text-sm w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: "var(--primary)" }}
                >
                  {q.number}
                </span>
                <div>
                  <p className="font-semibold text-sm leading-tight">{q.unit}</p>
                  {q.topic && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{q.topic}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" style={{ fontSize: "0.65rem" }}>
                  {q.subject.name}{q.subject.optionName ? ` · ${q.subject.optionName}` : ""}
                </Badge>
                {q.wrongType && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: WRONG_TYPE_COLORS[q.wrongType] ?? "#94a3b8" }}
                  >
                    {q.wrongType}
                  </span>
                )}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: DIFFICULTY_COLORS[q.difficulty] ?? "#94a3b8" }}
                >
                  난이도 {q.difficulty}
                </span>
              </div>

              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {q.subject.exam.name} · {new Date(q.subject.exam.date).toLocaleDateString("ko-KR")}
              </p>

              {q.memo && (
                <p className="text-xs p-2 rounded" style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                  {q.memo}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
