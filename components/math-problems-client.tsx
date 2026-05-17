"use client";

import { useState } from "react";
import { Trash2, FileDown, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

type Problem = {
  id: string;
  title: string;
  source: string;
  unit: string;
  problem: string;
  aiNote: string;
  memo: string;
  mimeType: string;
  category: string;
  createdAt: string;
};

// ── LaTeX 렌더러 ──────────────────────────────────────────────
type MathPart = { type: "text" | "inline" | "block"; content: string };

function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = [];
  const blockRe = /\$\$([\s\S]*?)\$\$/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(text)) !== null) {
    if (match.index > last) splitInline(text.slice(last, match.index), parts);
    parts.push({ type: "block", content: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) splitInline(text.slice(last), parts);
  return parts;
}

function splitInline(text: string, out: MathPart[]) {
  const inlineRe = /\$((?:[^$\\]|\\.)+?)\$/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > last) out.push({ type: "text", content: text.slice(last, match.index) });
    out.push({ type: "inline", content: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", content: text.slice(last) });
}

function MathRenderer({ text }: { text: string }) {
  const parts = splitMath(text);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === "block") return <span key={i} className="block my-1"><BlockMath math={part.content} /></span>;
        if (part.type === "inline") return <InlineMath key={i} math={part.content} />;
        return (
          <span key={i}>
            {part.content.split("\n").map((line, j, arr) => (
              <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

export function MathProblemsClient({ initialProblems }: { initialProblems: Problem[] }) {
  const [problems, setProblems] = useState<Problem[]>(initialProblems);
  const [tab, setTab] = useState<"오답" | "최적화">("오답");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", source: "", unit: "", problem: "", aiNote: "", memo: "" });

  const filtered = problems.filter((p) => (p.category || "오답") === tab);

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function selectAll() {
    setSelected(filtered.length === selected.size ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  async function deleteProblem(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/math-problems/${id}`, { method: "DELETE" });
    setProblems((p) => p.filter((x) => x.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  function startEdit(p: Problem) {
    setEditing(p.id);
    setEditForm({ title: p.title, source: p.source, unit: p.unit, problem: p.problem ?? "", aiNote: p.aiNote, memo: p.memo });
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/math-problems/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, problem: editForm.problem }),
    });
    const updated = await res.json();
    setProblems((p) => p.map((x) => x.id === id ? { ...x, ...updated } : x));
    setEditing(null);
  }

  // 프린트 기반 PDF — 시험지 스타일 (좌우 1문제씩, 가운데 세로줄, 아래 풀이 공간)
  async function exportPDF() {
    const targets = filtered.filter((p) => selected.size === 0 || selected.has(p.id));
    if (targets.length === 0) return;

    // problem 텍스트가 없는 구 데이터는 imageData 포함 fetch
    const full = await Promise.all(
      targets.map(async (p) => {
        if (p.problem) return p as Problem & { imageData: string };
        const data = await fetch(`/api/math-problems/${p.id}`).then((r) => r.json());
        return data as Problem & { imageData: string };
      })
    );

    // HTML 이스케이프
    function esc(s: string) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function cell(p: typeof full[0], num: number) {
      const hasText = Boolean(p.problem);
      const imgSrc = !hasText && p.imageData ? `data:${p.mimeType};base64,${p.imageData}` : "";
      const problemContent = hasText
        ? `<div class="prob-text" data-latex="${esc(p.problem)}">${esc(p.problem)}</div>`
        : imgSrc
          ? `<img class="prob-img" src="${imgSrc}" alt="문제 ${num}">`
          : '<div class="no-content">문제 없음</div>';
      return `
        <div class="cell">
          <div class="cell-header">
            <span class="num">${num}.</span>
            <span class="source">${esc(p.source || "")}</span>
            ${p.unit ? `<span class="unit">[${esc(p.unit)}]</span>` : ""}
          </div>
          ${problemContent}
        </div>`;
    }

    const pages: typeof full[] = [];
    for (let i = 0; i < full.length; i += 2) pages.push(full.slice(i, i + 2));

    const pageHtml = pages.map((pair, pi) => `
      <div class="page${pi > 0 ? " break" : ""}">
        <div class="row">
          ${cell(pair[0], pi * 2 + 1)}
          <div class="vline"></div>
          ${pair[1] ? cell(pair[1], pi * 2 + 2) : '<div class="cell"></div>'}
        </div>
      </div>`).join("");

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>수학 오답 정리</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    @page { size: A4 portrait; margin: 10mm 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #111; font-size: 10pt; }

    .page { width: 100%; }
    .break { page-break-before: always; }

    .row {
      display: flex;
      width: 100%;
      min-height: 277mm;
    }

    .cell {
      flex: 1;
      padding: 5mm 6mm;
      display: flex;
      flex-direction: column;
    }

    .vline {
      width: 1px;
      background: #555;
      flex-shrink: 0;
    }

    .cell-header {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 3mm;
      padding-bottom: 2mm;
      border-bottom: 1px solid #ccc;
    }

    .num { font-size: 11pt; font-weight: 900; color: #111; }
    .source { font-size: 9pt; color: #444; font-weight: 600; }
    .unit { font-size: 8pt; color: #888; }

    .prob-text {
      font-size: 10pt;
      line-height: 1.8;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .prob-text .katex-display { margin: 4px 0; }

    .prob-img {
      width: 100%;
      object-fit: contain;
      object-position: top left;
      max-height: 110mm;
    }

    .no-content { color: #bbb; font-size: 9pt; text-align: center; padding: 10mm 0; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${pageHtml}
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>
  <script>
    window.onload = function() {
      // LaTeX 렌더링
      document.querySelectorAll('.prob-text').forEach(function(el) {
        var raw = el.getAttribute('data-latex') || '';
        var html = '';
        // $$...$$ 블록 수식 우선, 그 다음 $...$ 인라인
        var parts = [];
        var blockRe = /\\$\\$([\\s\\S]*?)\\$\\$/g;
        var last = 0, m;
        while ((m = blockRe.exec(raw)) !== null) {
          if (m.index > last) parts.push({t:'text', c: raw.slice(last, m.index)});
          parts.push({t:'block', c: m[1]});
          last = m.index + m[0].length;
        }
        if (last < raw.length) parts.push({t:'text', c: raw.slice(last)});

        parts.forEach(function(p) {
          if (p.t === 'block') {
            try { html += '<span class="katex-display">' + katex.renderToString(p.c, {displayMode:true, throwOnError:false}) + '</span>'; }
            catch(e) { html += '<span>' + p.c + '</span>'; }
          } else {
            // 인라인 수식 $...$
            var inRe = /\\$([^$\\\\]|\\\\.)+?\\$/g;
            var il = 0, im;
            var seg = '';
            while ((im = inRe.exec(p.c)) !== null) {
              if (im.index > il) seg += p.c.slice(il, im.index).replace(/\\n/g,'<br>');
              try { seg += katex.renderToString(im[0].slice(1,-1), {displayMode:false, throwOnError:false}); }
              catch(e) { seg += im[0]; }
              il = im.index + im[0].length;
            }
            if (il < p.c.length) seg += p.c.slice(il).replace(/\\n/g,'<br>');
            html += seg;
          }
        });
        el.innerHTML = html;
      });
      setTimeout(function(){ window.print(); }, 800);
    };
  <\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  const labelStyle: React.CSSProperties = { color: "var(--muted-foreground)", fontSize: "0.7rem", fontWeight: 600 };
  const cardBase = { background: "var(--card)" };

  const odapCount = problems.filter((p) => (p.category || "오답") === "오답").length;
  const optCount = problems.filter((p) => p.category === "최적화").length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">수학 오답 정리</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            {tab === "오답" ? `오답 ${odapCount}개` : `최적화 후보 ${optCount}개`}
            {selected.size > 0 ? ` · ${selected.size}개 선택됨` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button onClick={selectAll} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              {selected.size === filtered.length ? "선택 해제" : "전체 선택"}
            </button>
          )}
          <Button onClick={() => void exportPDF()} disabled={filtered.length === 0} className="flex items-center gap-2">
            <FileDown size={15} />
            PDF{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex rounded-xl border p-1 gap-1" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
        {([["오답", `오답 ${odapCount}`], ["최적화", `⚡ 최적화 후보 ${optCount}`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setSelected(new Set()); }}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === key ? "var(--card)" : "transparent",
              color: tab === key ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", ...cardBase, color: "var(--muted-foreground)" }}>
          <p className="mb-2">{tab === "오답" ? "저장된 오답이 없습니다." : "최적화 후보가 없습니다."}</p>
          <p className="text-sm">
            {tab === "오답" ? "AI 수학 도우미에서 분석 후 저장해보세요." : "모의고사 분석에서 자동으로 수집됩니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
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
                    <label style={labelStyle}>문제 텍스트 (LaTeX)</label>
                    <Textarea value={editForm.problem} onChange={(e) => setEditForm((f) => ({ ...f, problem: e.target.value }))} rows={5} style={{ background: "var(--muted)", borderColor: "var(--border)", fontSize: "0.8rem", fontFamily: "monospace" }} />
                  </div>
                  <div className="space-y-1">
                    <label style={labelStyle}>AI 분석</label>
                    <Textarea value={editForm.aiNote} onChange={(e) => setEditForm((f) => ({ ...f, aiNote: e.target.value }))} rows={4} style={{ background: "var(--muted)", borderColor: "var(--border)", fontSize: "0.8rem" }} />
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

                      {/* 문제 텍스트 (LaTeX 렌더링) */}
                      {p.problem && (
                        <div className="text-sm rounded-lg p-3" style={{ background: "var(--muted)", borderLeft: "3px solid var(--primary)" }}>
                          <MathRenderer text={p.problem} />
                        </div>
                      )}

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
