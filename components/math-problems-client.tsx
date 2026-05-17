"use client";

import { useState, useCallback } from "react";
import { Trash2, FileDown, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Problem = {
  id: string;
  title: string;
  unit: string;
  memo: string;
  aiNote: string;
  mimeType: string;
  createdAt: string;
  imageData?: string; // 전체 조회 시만 포함
};

type Props = { initialProblems: Problem[] };

export function MathProblemsClient({ initialProblems }: Props) {
  const [problems, setProblems] = useState<Problem[]>(initialProblems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", unit: "", memo: "" });
  const [exporting, setExporting] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
    setEditForm({ title: p.title, unit: p.unit, memo: p.memo });
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

  // PDF 내보내기 (A4, 2문제/페이지)
  const exportPDF = useCallback(async () => {
    const ids = selected.size > 0 ? [...selected] : problems.map((p) => p.id);
    if (ids.length === 0) return;
    setExporting(true);

    try {
      // 이미지 데이터 fetch
      const fullProblems = await Promise.all(
        ids.map((id) => fetch(`/api/math-problems/${id}`).then((r) => r.json()) as Promise<Problem & { imageData: string }>)
      );

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const pageH = 297;
      const margin = 12;
      const slotH = (pageH - margin * 3) / 2; // 두 문제 슬롯 높이
      const contentW = pageW - margin * 2;

      for (let i = 0; i < fullProblems.length; i++) {
        const p = fullProblems[i];
        const slotIdx = i % 2; // 0: 상단, 1: 하단
        if (i > 0 && slotIdx === 0) pdf.addPage();

        const yBase = margin + slotIdx * (slotH + margin);

        // 구분선
        if (slotIdx === 1) {
          pdf.setDrawColor(200, 200, 200);
          pdf.line(margin, yBase - margin / 2, pageW - margin, yBase - margin / 2);
        }

        // 제목/단원 텍스트 (영문/숫자만 렌더링, 한글은 jsPDF 미지원)
        const label = `[${i + 1}] ${p.unit || ""}`;
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(label, margin, yBase + 5);

        // 이미지
        if (p.imageData) {
          const imgDataUrl = `data:${p.mimeType};base64,${p.imageData}`;
          const imgY = yBase + 8;
          const maxImgH = slotH - 10;

          // 이미지 비율 계산
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const ratio = img.height / img.width;
              const imgW = Math.min(contentW, contentW);
              const imgH = Math.min(imgW * ratio, maxImgH);
              const finalW = imgH < maxImgH ? imgW : maxImgH / ratio;
              pdf.addImage(imgDataUrl, p.mimeType === "image/png" ? "PNG" : "JPEG", margin, imgY, finalW, Math.min(imgH, maxImgH));
              resolve();
            };
            img.src = imgDataUrl;
          });
        }

        // 메모 (하단)
        if (p.memo) {
          pdf.setFontSize(8);
          pdf.setTextColor(80, 80, 80);
          const memoY = yBase + slotH - 6;
          pdf.text(p.memo.slice(0, 80), margin, memoY);
        }
      }

      pdf.save("수학_오답정리.pdf");
    } finally {
      setExporting(false);
    }
  }, [problems, selected]);

  const labelStyle: React.CSSProperties = { color: "var(--muted-foreground)", fontSize: "0.7rem", fontWeight: 600 };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">수학 오답 정리</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            저장된 문제 {problems.length}개
          </p>
        </div>
        <div className="flex items-center gap-2">
          {problems.length > 0 && (
            <button
              onClick={selectAll}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              {selected.size === problems.length ? "선택 해제" : "전체 선택"}
            </button>
          )}
          <Button
            onClick={exportPDF}
            disabled={exporting || problems.length === 0}
            className="flex items-center gap-2"
          >
            <FileDown size={15} />
            {exporting ? "생성 중..." : `PDF 내보내기${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </Button>
        </div>
      </div>

      {problems.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)" }}
        >
          <p className="mb-2">저장된 문제가 없습니다.</p>
          <p className="text-sm">AI 수학 도우미에서 분석 후 문제를 저장해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {problems.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border p-4 transition-all cursor-pointer"
              style={{
                background: "var(--card)",
                borderColor: selected.has(p.id) ? "var(--primary)" : "var(--border)",
                borderWidth: selected.has(p.id) ? 2 : 1,
              }}
              onClick={() => toggleSelect(p.id)}
            >
              <div className="flex items-start gap-3">
                {/* 선택 체크박스 */}
                <div
                  className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: selected.has(p.id) ? "var(--primary)" : "transparent",
                    borderColor: selected.has(p.id) ? "var(--primary)" : "var(--border)",
                  }}
                >
                  {selected.has(p.id) && <Check size={12} color="white" />}
                </div>

                <div className="flex-1 space-y-2">
                  {editing === p.id ? (
                    /* 편집 폼 */
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="제목"
                        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
                      />
                      <Input
                        value={editForm.unit}
                        onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                        placeholder="단원"
                        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
                      />
                      <Textarea
                        value={editForm.memo}
                        onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))}
                        placeholder="메모"
                        rows={2}
                        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(p.id)}>저장</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>취소</Button>
                      </div>
                    </div>
                  ) : (
                    /* 일반 표시 */
                    <>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{p.title || "(제목 없음)"}</p>
                        {p.unit && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                            {p.unit}
                          </span>
                        )}
                      </div>
                      {p.memo && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{p.memo}</p>}
                      <p style={labelStyle}>{new Date(p.createdAt).toLocaleDateString("ko-KR")}</p>
                    </>
                  )}
                </div>

                {/* 액션 버튼 */}
                {editing !== p.id && (
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 rounded"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteProblem(p.id)}
                      className="p-1.5 rounded"
                      style={{ color: "var(--destructive)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
