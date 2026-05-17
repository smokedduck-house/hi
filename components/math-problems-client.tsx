"use client";

import { useState } from "react";
import { Trash2, FileDown, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Problem = {
  id: string;
  title: string;
  source: string;
  unit: string;
  aiNote: string;
  memo: string;
  createdAt: string;
};

export function MathProblemsClient({ initialProblems }: { initialProblems: Problem[] }) {
  const [problems, setProblems] = useState<Problem[]>(initialProblems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", source: "", unit: "", aiNote: "", memo: "" });

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function selectAll() {
    setSelected(problems.length === selected.size ? new Set() : new Set(problems.map((p) => p.id)));
  }

  async function deleteProblem(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/math-problems/${id}`, { method: "DELETE" });
    setProblems((p) => p.filter((x) => x.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  function startEdit(p: Problem) {
    setEditing(p.id);
    setEditForm({ title: p.title, source: p.source, unit: p.unit, aiNote: p.aiNote, memo: p.memo });
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/math-problems/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const updated = await res.json();
    setProblems((p) => p.map((x) => x.id === id ? { ...x, ...updated } : x));
    setEditing(null);
  }

  // 프린트 기반 PDF (한글 완벽 지원)
  function exportPDF() {
    const targets = problems.filter((p) => selected.size === 0 || selected.has(p.id));
    if (targets.length === 0) return;

    const rows = targets.map((p, i) => `
      <div class="problem">
        <div class="problem-header">
          <span class="num">${i + 1}</span>
          <span class="source">${p.source || "출처 미입력"}</span>
          ${p.unit ? `<span class="unit">${p.unit}</span>` : ""}
          ${p.title ? `<span class="title-badge">${p.title}</span>` : ""}
        </div>
        ${p.aiNote ? `<div class="ai-note"><div class="section-label">AI 분석</div><div class="ai-text">${p.aiNote.replace(/\n/g, "<br>")}</div></div>` : ""}
        ${p.memo ? `<div class="memo"><div class="section-label">내 생각</div><div class="memo-text">${p.memo.replace(/\n/g, "<br>")}</div></div>` : ""}
      </div>
      ${(i % 2 === 1 && i < targets.length - 1) ? '<div class="page-break"></div>' : ""}
    `).join('<div class="divider"></div>');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>수학 오답 정리</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif; font-size: 11pt; color: #222; margin: 0; }
    .problem { padding: 6mm 0; min-height: 128mm; }
    .problem-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4mm; flex-wrap: wrap; }
    .num { background: #222; color: #fff; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: bold; flex-shrink: 0; }
    .source { font-weight: bold; font-size: 12pt; }
    .unit { background: #f0f0f0; color: #555; font-size: 9pt; padding: 2px 8px; border-radius: 20px; }
    .title-badge { background: #e8f0fe; color: #1a56db; font-size: 9pt; padding: 2px 8px; border-radius: 20px; }
    .section-label { font-size: 8pt; font-weight: 700; color: #888; letter-spacing: 0.05em; margin-bottom: 2mm; }
    .ai-note { background: #f8f9fa; border-left: 3px solid #4f46e5; padding: 3mm 4mm; border-radius: 0 4px 4px 0; margin-bottom: 3mm; }
    .ai-text { font-size: 10pt; line-height: 1.7; white-space: pre-wrap; }
    .memo { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 3mm 4mm; border-radius: 0 4px 4px 0; }
    .memo-text { font-size: 10pt; line-height: 1.6; }
    .divider { border: none; border-top: 1px dashed #ccc; margin: 0; }
    .page-break { page-break-after: always; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div style="text-align:center; margin-bottom: 6mm; border-bottom: 2px solid #222; padding-bottom: 3mm;">
    <strong style="font-size: 14pt;">수학 오답 정리</strong>
    <span style="font-size: 9pt; color: #888; margin-left: 8px;">${new Date().toLocaleDateString("ko-KR")} · ${targets.length}문제</span>
  </div>
  ${rows}
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  const labelStyle: React.CSSProperties = { color: "var(--muted-foreground)", fontSize: "0.7rem", fontWeight: 600 };
  const cardBase = { background: "var(--card)" };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">수학 오답 정리</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            저장된 문제 {problems.length}개{selected.size > 0 ? ` · ${selected.size}개 선택됨` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {problems.length > 0 && (
            <button onClick={selectAll} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              {selected.size === problems.length ? "선택 해제" : "전체 선택"}
            </button>
          )}
          <Button onClick={exportPDF} disabled={problems.length === 0} className="flex items-center gap-2">
            <FileDown size={15} />
            PDF{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      </div>

      {problems.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", ...cardBase, color: "var(--muted-foreground)" }}>
          <p className="mb-2">저장된 문제가 없습니다.</p>
          <p className="text-sm">AI 수학 도우미에서 분석 후 저장해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {problems.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border transition-all"
              style={{ ...cardBase, borderColor: selected.has(p.id) ? "var(--primary)" : "var(--border)", borderWidth: selected.has(p.id) ? 2 : 1 }}
            >
              {editing === p.id ? (
                /* 편집 모드 */
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label style={labelStyle}>출처</label>
                      <Input value={editForm.source} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))} placeholder="2025학년도 수능 수학 29번" style={{ background: "var(--muted)", borderColor: "var(--border)" }} />
                    </div>
                    <div className="space-y-1">
                      <label style={labelStyle}>단원</label>
                      <Input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} placeholder="수열" style={{ background: "var(--muted)", borderColor: "var(--border)" }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label style={labelStyle}>제목</label>
                    <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} style={{ background: "var(--muted)", borderColor: "var(--border)" }} />
                  </div>
                  <div className="space-y-1">
                    <label style={labelStyle}>AI 분석</label>
                    <Textarea value={editForm.aiNote} onChange={(e) => setEditForm((f) => ({ ...f, aiNote: e.target.value }))} rows={5} style={{ background: "var(--muted)", borderColor: "var(--border)", fontSize: "0.8rem" }} />
                  </div>
                  <div className="space-y-1">
                    <label style={labelStyle}>내 생각</label>
                    <Textarea value={editForm.memo} onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))} rows={2} style={{ background: "var(--muted)", borderColor: "var(--border)" }} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(p.id)}>저장</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                /* 표시 모드 */
                <div className="p-4 cursor-pointer" onClick={() => toggleSelect(p.id)}>
                  <div className="flex items-start gap-3">
                    {/* 체크박스 */}
                    <div className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: selected.has(p.id) ? "var(--primary)" : "transparent", borderColor: selected.has(p.id) ? "var(--primary)" : "var(--border)" }}>
                      {selected.has(p.id) && <Check size={12} color="white" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* 헤더 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.source && <span className="font-semibold text-sm">{p.source}</span>}
                        {p.unit && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{p.unit}</span>}
                        {p.title && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{p.title}</span>}
                      </div>

                      {/* AI 분석 미리보기 */}
                      {p.aiNote && (
                        <p className="text-xs line-clamp-2" style={{ color: "var(--muted-foreground)", borderLeft: "2px solid #4f46e5", paddingLeft: "8px" }}>
                          {p.aiNote}
                        </p>
                      )}

                      {/* 내 생각 */}
                      {p.memo && (
                        <p className="text-xs line-clamp-1" style={{ color: "var(--muted-foreground)", borderLeft: "2px solid #f59e0b", paddingLeft: "8px" }}>
                          {p.memo}
                        </p>
                      )}

                      <p style={labelStyle}>{new Date(p.createdAt).toLocaleDateString("ko-KR")}</p>
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded" style={{ color: "var(--muted-foreground)" }}><Pencil size={14} /></button>
                      <button onClick={() => deleteProblem(p.id)} className="p-1.5 rounded" style={{ color: "var(--destructive)" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
