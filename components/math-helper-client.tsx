"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { InlineMath, BlockMath } from "react-katex";
import { Upload, Camera, Crop, X, Send, BookmarkPlus, Check, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── 이미지 유틸 ──────────────────────────────────────────────
function resizeImage(file: File, maxPx = 1600, quality = 0.85): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve({ base64: canvas.toDataURL("image/jpeg", quality).split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function cropImage(imageSrc: string, pixelCrop: Area, quality = 0.85): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
      canvas.getContext("2d")!.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      resolve({ base64: canvas.toDataURL("image/jpeg", quality).split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

// ── KaTeX 렌더러 ──────────────────────────────────────────────
type MathPart = { type: "text" | "inline" | "block"; content: string };

function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = [];
  const blockRe = /\$\$([\s\S]*?)\$\$/g;
  let last = 0, match: RegExpExecArray | null;
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
  let last = 0, match: RegExpExecArray | null;
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
        if (part.type === "block") return <span key={i} className="block my-2"><BlockMath math={part.content} /></span>;
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

// ── 통합 분석 응답 렌더러 ─────────────────────────────────────
const SECTIONS = [
  { key: "풀이", color: "#3b82f6" },
  { key: "검토", color: "#10b981" },
  { key: "개념", color: "#8b5cf6" },
  { key: "최적화", color: "#f59e0b" },
];

function UnifiedResponse({ text }: { text: string }) {
  const sections: { title: string; content: string; color: string }[] = [];
  let remaining = text;

  for (let i = 0; i < SECTIONS.length; i++) {
    const { key, color } = SECTIONS[i];
    const header = `[${key}]`;
    const idx = remaining.indexOf(header);
    if (idx === -1) continue;
    const nextHeaders = SECTIONS.slice(i + 1).map((s) => `[${s.key}]`);
    let end = remaining.length;
    for (const nh of nextHeaders) {
      const ni = remaining.indexOf(nh, idx + header.length);
      if (ni !== -1 && ni < end) end = ni;
    }
    sections.push({ title: key, content: remaining.slice(idx + header.length, end).trim(), color });
  }

  const firstIdx = sections.length > 0 ? text.indexOf(`[${sections[0].title}]`) : text.length;
  const intro = text.slice(0, firstIdx).trim();

  return (
    <div className="space-y-3">
      {intro && <p className="text-sm whitespace-pre-wrap"><MathRenderer text={intro} /></p>}
      {sections.map(({ title, content, color }) => (
        <div key={title} className="rounded-xl border p-4" style={{ borderLeftWidth: 4, borderColor: color, background: "var(--muted)" }}>
          <p className="text-xs font-bold mb-2" style={{ color }}>{title}</p>
          <div className="text-sm whitespace-pre-wrap"><MathRenderer text={content} /></div>
        </div>
      ))}
    </div>
  );
}

// ── PROBLEM_TEXT 파싱 ─────────────────────────────────────────
const PROB_START = "---PROBLEM_TEXT_START---";
const PROB_END = "---PROBLEM_TEXT_END---";

function parseProblemText(raw: string): { problemText: string; displayText: string } {
  const si = raw.indexOf(PROB_START);
  const ei = raw.indexOf(PROB_END);
  if (si === -1 || ei === -1 || ei <= si) return { problemText: "", displayText: raw };
  const problemText = raw.slice(si + PROB_START.length, ei).trim();
  const displayText = (raw.slice(0, si) + raw.slice(ei + PROB_END.length)).trim();
  return { problemText, displayText };
}

// ── 저장 다이얼로그 ────────────────────────────────────────────
function SaveDialog({ onSave, onCancel, aiNote, problemText: initialProblemText }: {
  onSave: (title: string, source: string, unit: string, problemText: string, aiNote: string, memo: string) => Promise<void>;
  onCancel: () => void;
  aiNote: string;
  problemText: string;
}) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [unit, setUnit] = useState("");
  const [editedProblem, setEditedProblem] = useState(initialProblemText);
  const [editedAi, setEditedAi] = useState(aiNote);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const inputStyle = { background: "var(--muted)", borderColor: "var(--border)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="rounded-2xl border w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="p-6 space-y-4">
          <h3 className="font-bold text-lg">오답 저장</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>출처</label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="예: 2025학년도 수능 수학 29번" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>제목 (선택)</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 점화식 29번" style={inputStyle} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>단원 (선택)</label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="예: 수열" style={inputStyle} />
              </div>
            </div>
            {editedProblem && (
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>문제 텍스트 (LaTeX)</label>
                <Textarea value={editedProblem} onChange={(e) => setEditedProblem(e.target.value)} rows={5} style={{ ...inputStyle, fontSize: "0.8rem", fontFamily: "monospace" }} />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>AI 분석 (편집 가능)</label>
              <Textarea value={editedAi} onChange={(e) => setEditedAi(e.target.value)} rows={6} style={{ ...inputStyle, fontSize: "0.8rem" }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>내 생각 / 메모</label>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="틀린 이유, 다음엔 주의할 점 등" rows={3} style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel}>취소</Button>
            <Button disabled={saving} onClick={async () => { setSaving(true); await onSave(title, source, unit, editedProblem, editedAi, memo); }}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 이미지 업로드 공통 컴포넌트 ──────────────────────────────
function ImageUploader({ onFile, compact = false }: { onFile: (file: File) => void; compact?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (compact) {
    return (
      <div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed flex items-center justify-center gap-2 py-3 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <Upload size={15} /> 이미지 업로드
        </button>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-4 cursor-pointer"
      style={{ borderColor: "var(--border)" }}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
    >
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--muted)" }}>
        <Upload size={24} style={{ color: "var(--primary)" }} />
      </div>
      <div className="text-center">
        <p className="font-medium">풀이 사진을 드래그하거나 클릭해서 업로드</p>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>jpeg / png / webp · 최대 10MB</p>
      </div>
      <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        onClick={(e) => {
          e.stopPropagation();
          const input = document.createElement("input");
          input.type = "file"; input.accept = "image/*"; input.capture = "environment";
          input.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) onFile(f); };
          input.click();
        }}
      >
        <Camera size={16} /> 카메라로 촬영
      </button>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ── 문제 분석 탭 ──────────────────────────────────────────────
function AnalysisTab() {
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [hint, setHint] = useState("");
  const [response, setResponse] = useState("");
  const [problemText, setProblemText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streaming && responseRef.current) responseRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [response, streaming]);

  const handleFile = useCallback(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("jpeg, png, webp만 허용됩니다."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("이미지 최대 10MB."); return; }
    setError(""); setResponse(""); setSavedId(null);
    const { base64, mimeType } = await resizeImage(file);
    setRawImage(`data:${mimeType};base64,${base64}`);
    setFinalImage({ base64, mimeType });
    setCropping(false);
  }, []);

  const handleCropDone = useCallback(async () => {
    if (!rawImage || !croppedAreaPixels) return;
    setFinalImage(await cropImage(rawImage, croppedAreaPixels));
    setCropping(false);
  }, [rawImage, croppedAreaPixels]);

  const handleSubmit = useCallback(async () => {
    if (!finalImage) { setError("이미지를 먼저 업로드해주세요."); return; }
    if (streaming) { abortRef.current?.abort(); setStreaming(false); return; }

    setError(""); setResponse(""); setProblemText(""); setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/math-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: finalImage.base64, mimeType: finalImage.mimeType, hint: hint || undefined }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) { setError(await res.text()); setStreaming(false); return; }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setResponse(buf);
      }
      const parsed = parseProblemText(buf);
      setProblemText(parsed.problemText);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("요청 중 오류가 발생했습니다.");
    } finally {
      setStreaming(false);
    }
  }, [finalImage, hint, streaming]);

  const handleSave = useCallback(async (title: string, source: string, unit: string, problem: string, aiNote: string, memo: string) => {
    const res = await fetch("/api/math-problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, source, unit, problem, aiNote, memo, category: "오답" }),
    });
    const data = await res.json();
    setSavedId(data.id);
    setShowSaveDialog(false);
  }, []);

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="space-y-5">
      {showSaveDialog && (
        <SaveDialog
          aiNote={parseProblemText(response).displayText}
          problemText={problemText}
          onSave={handleSave}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}

      {/* 이미지 영역 */}
      {!rawImage ? (
        <ImageUploader onFile={handleFile} />
      ) : cropping ? (
        <div className="rounded-xl border overflow-hidden" style={cardStyle}>
          <div className="relative w-full" style={{ height: 320, background: "#000" }}>
            <Cropper image={rawImage} crop={crop} zoom={zoom} aspect={undefined}
              onCropChange={setCrop} onZoomChange={setZoom}
              onCropComplete={(_, ap) => setCroppedAreaPixels(ap)} />
          </div>
          <div className="flex items-center gap-3 p-3">
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
            <Button size="sm" onClick={handleCropDone}><Crop size={14} className="mr-1" /> 완료</Button>
            <Button size="sm" variant="outline" onClick={() => setCropping(false)}>취소</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border p-3 flex gap-3 items-start" style={cardStyle}>
          <img src={`data:${finalImage?.mimeType};base64,${finalImage?.base64}`} alt="미리보기"
            className="w-32 h-24 object-cover rounded-lg flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">이미지 업로드 완료</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCropping(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: "var(--muted)" }}>
                <Crop size={12} /> 잘라내기
              </button>
              <button onClick={() => { setRawImage(null); setFinalImage(null); setResponse(""); setSavedId(null); }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: "var(--muted)" }}>
                <X size={12} /> 제거
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 힌트 */}
      {rawImage && (
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>막힌 부분이나 추가 질문 (선택)</label>
          <Textarea value={hint} onChange={(e) => setHint(e.target.value)}
            placeholder="예: 3번째 줄까지 썼는데 다음을 모르겠어요" rows={2}
            style={{ background: "var(--muted)", borderColor: "var(--border)" }} />
        </div>
      )}

      {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>{error}</p>}

      {finalImage && !cropping && (
        <Button onClick={handleSubmit} className="w-full" style={streaming ? { background: "var(--destructive)", color: "#fff" } : {}}>
          {streaming ? <><X size={16} className="mr-2" />중단</> : <><Send size={16} className="mr-2" />AI 분석</>}
        </Button>
      )}

      {/* 응답 */}
      {(response || streaming) && (
        <div ref={responseRef} className="rounded-xl border p-5 space-y-3" style={cardStyle}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
              AI 분석 결과 {streaming && <span className="ml-1 animate-pulse">●</span>}
            </p>
            {response && !streaming && (
              <div className="flex items-center gap-2">
                {savedId ? (
                  <span className="text-xs flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                    <Check size={12} /> 저장됨
                  </span>
                ) : (
                  <button onClick={() => setShowSaveDialog(true)}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                    <BookmarkPlus size={12} /> 오답 저장
                  </button>
                )}
                <button onClick={() => { setResponse(""); setProblemText(""); setSavedId(null); }}
                  className="text-xs px-2 py-1 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                  다시
                </button>
              </div>
            )}
          </div>
          <div className="text-sm leading-relaxed">
            {streaming
              ? <div className="whitespace-pre-wrap"><MathRenderer text={response} /></div>
              : <UnifiedResponse text={parseProblemText(response).displayText} />
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── 모의고사 분석 탭 ──────────────────────────────────────────
type ProblemEntry = {
  id: string;
  num: string;
  category: "틀림" | "최적화확인";
  image: { base64: string; mimeType: string } | null;
  status: "idle" | "analyzing" | "done" | "error";
  result?: {
    problemText: string;
    solution: string;
    concept: string;
    isOptimizable: boolean;
    optimizeTip: string;
  };
  savedId?: string;
  errorMsg?: string;
  expanded?: boolean;
};

function ExamTab() {
  const [examSource, setExamSource] = useState("");
  const [problems, setProblems] = useState<ProblemEntry[]>([
    { id: crypto.randomUUID(), num: "", category: "틀림", image: null, status: "idle", expanded: true },
  ]);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizeCandidates, setOptimizeCandidates] = useState<ProblemEntry[]>([]);

  function addProblem() {
    setProblems((p) => [...p, { id: crypto.randomUUID(), num: "", category: "틀림", image: null, status: "idle", expanded: true }]);
  }

  function removeProblem(id: string) {
    setProblems((p) => p.filter((x) => x.id !== id));
  }

  function updateProblem(id: string, patch: Partial<ProblemEntry>) {
    setProblems((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));
  }

  async function handleFileForProblem(id: string, file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    const image = await resizeImage(file);
    updateProblem(id, { image });
  }

  async function analyzeAll() {
    const toAnalyze = problems.filter((p) => p.image);
    if (toAnalyze.length === 0) return;

    setAnalyzing(true);
    const newCandidates: ProblemEntry[] = [];

    for (const prob of toAnalyze) {
      updateProblem(prob.id, { status: "analyzing" });

      try {
        const res = await fetch("/api/exam-analyzer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: prob.image!.base64, mimeType: prob.image!.mimeType }),
        });

        if (!res.ok) {
          updateProblem(prob.id, { status: "error", errorMsg: "분석 실패" });
          continue;
        }

        const result = await res.json() as ProblemEntry["result"];
        let savedId: string | undefined;

        // 틀린 문제는 오답정리에 자동 저장
        if (prob.category === "틀림") {
          const label = prob.num ? `${examSource || "모의고사"} ${prob.num}번` : (examSource || "모의고사");
          const saveRes = await fetch("/api/math-problems", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: label,
              problem: result!.problemText,
              aiNote: `[풀이]\n${result!.solution}\n\n[개념]\n${result!.concept}`,
              category: "오답",
            }),
          });
          const saved = await saveRes.json();
          savedId = saved.id;
        }

        // 최적화 가능한 문제 수집
        if (result!.isOptimizable) {
          newCandidates.push({ ...prob, result, savedId });
        }

        updateProblem(prob.id, { status: "done", result, savedId, expanded: false });
      } catch {
        updateProblem(prob.id, { status: "error", errorMsg: "네트워크 오류" });
      }
    }

    // 최적화 후보가 있으면 DB에도 저장
    for (const cand of newCandidates) {
      const label = cand.num ? `${examSource || "모의고사"} ${cand.num}번` : (examSource || "모의고사");
      await fetch("/api/math-problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: label,
          problem: cand.result!.problemText,
          aiNote: `[최적화 팁]\n${cand.result!.optimizeTip}\n\n[개념]\n${cand.result!.concept}`,
          category: "최적화",
        }),
      });
    }

    setOptimizeCandidates((prev) => [...prev, ...newCandidates]);
    setAnalyzing(false);
  }

  const doneCount = problems.filter((p) => p.status === "done").length;
  const savedCount = problems.filter((p) => p.savedId).length;
  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="space-y-5">
      {/* 시험명 */}
      <div className="space-y-1">
        <label className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>시험명</label>
        <Input value={examSource} onChange={(e) => setExamSource(e.target.value)}
          placeholder="예: 2026 수능 수학, 6월 모평 수학" style={{ background: "var(--muted)", borderColor: "var(--border)" }} />
      </div>

      {/* 문제 목록 */}
      <div className="space-y-3">
        {problems.map((prob) => (
          <div key={prob.id} className="rounded-xl border" style={cardStyle}>
            {/* 헤더 */}
            <div className="flex items-center gap-2 p-3">
              {/* 문제 번호 */}
              <Input
                value={prob.num}
                onChange={(e) => updateProblem(prob.id, { num: e.target.value })}
                placeholder="번호"
                className="w-16 text-center"
                style={{ background: "var(--muted)", borderColor: "var(--border)" }}
              />

              {/* 카테고리 토글 */}
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                {(["틀림", "최적화확인"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => updateProblem(prob.id, { category: cat })}
                    className="px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: prob.category === cat ? (cat === "틀림" ? "#ef4444" : "#f59e0b") : "var(--muted)",
                      color: prob.category === cat ? "#fff" : "var(--muted-foreground)",
                    }}
                  >
                    {cat === "틀림" ? "✗ 틀림" : "⚡ 최적화확인"}
                  </button>
                ))}
              </div>

              {/* 상태 표시 */}
              <div className="flex-1 flex items-center justify-end gap-2">
                {prob.status === "analyzing" && <Loader2 size={14} className="animate-spin" style={{ color: "var(--primary)" }} />}
                {prob.status === "done" && prob.category === "틀림" && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                    <Check size={10} className="inline mr-1" />오답저장
                  </span>
                )}
                {prob.status === "done" && prob.result?.isOptimizable && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                    ⚡ 최적화가능
                  </span>
                )}
                {prob.status === "error" && <span className="text-xs" style={{ color: "var(--destructive)" }}>오류</span>}
                <button onClick={() => updateProblem(prob.id, { expanded: !prob.expanded })}
                  className="p-1" style={{ color: "var(--muted-foreground)" }}>
                  {prob.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button onClick={() => removeProblem(prob.id)} className="p-1" style={{ color: "var(--muted-foreground)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* 이미지 + 결과 */}
            {prob.expanded && (
              <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="pt-3">
                  {prob.image ? (
                    <div className="flex items-center gap-2">
                      <img src={`data:${prob.image.mimeType};base64,${prob.image.base64}`} alt="문제"
                        className="w-20 h-16 object-cover rounded" style={{ border: "1px solid var(--border)" }} />
                      <button onClick={() => updateProblem(prob.id, { image: null })}
                        className="text-xs px-2 py-1 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                        <X size={12} className="inline mr-1" />제거
                      </button>
                    </div>
                  ) : (
                    <ImageUploader onFile={(f) => handleFileForProblem(prob.id, f)} compact />
                  )}
                </div>

                {/* 분석 결과 */}
                {prob.status === "done" && prob.result && (
                  <div className="space-y-2 text-sm">
                    {prob.result.problemText && (
                      <div className="rounded-lg p-3" style={{ background: "rgba(59,130,246,0.08)", borderLeft: "3px solid #3b82f6" }}>
                        <p className="text-xs font-bold mb-1" style={{ color: "#3b82f6" }}>문제</p>
                        <div className="text-xs"><MathRenderer text={prob.result.problemText} /></div>
                      </div>
                    )}
                    <div className="rounded-lg p-3" style={{ background: "var(--muted)" }}>
                      <p className="text-xs font-bold mb-1" style={{ color: "#10b981" }}>풀이</p>
                      <div className="text-xs whitespace-pre-wrap"><MathRenderer text={prob.result.solution} /></div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--muted)" }}>
                      <p className="text-xs font-bold mb-1" style={{ color: "#8b5cf6" }}>개념</p>
                      <div className="text-xs whitespace-pre-wrap"><MathRenderer text={prob.result.concept} /></div>
                    </div>
                    {prob.result.isOptimizable && prob.result.optimizeTip && (
                      <div className="rounded-lg p-3" style={{ background: "rgba(245,158,11,0.08)", borderLeft: "3px solid #f59e0b" }}>
                        <p className="text-xs font-bold mb-1" style={{ color: "#f59e0b" }}>⚡ 최적화</p>
                        <div className="text-xs whitespace-pre-wrap"><MathRenderer text={prob.result.optimizeTip} /></div>
                      </div>
                    )}
                  </div>
                )}
                {prob.status === "error" && (
                  <p className="text-xs px-3 py-2 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>
                    {prob.errorMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        <button onClick={addProblem}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border w-full justify-center"
          style={{ borderColor: "var(--border)", borderStyle: "dashed", color: "var(--muted-foreground)" }}>
          <Plus size={14} /> 문제 추가
        </button>
      </div>

      {/* 분석 버튼 */}
      <Button onClick={analyzeAll} disabled={analyzing || problems.every((p) => !p.image)} className="w-full">
        {analyzing
          ? <><Loader2 size={16} className="mr-2 animate-spin" />분석 중... ({doneCount}/{problems.filter((p) => p.image).length})</>
          : <>AI 분석 시작 · 틀린 문제 자동 저장</>
        }
      </Button>

      {/* 완료 요약 */}
      {doneCount > 0 && !analyzing && (
        <div className="rounded-xl border p-4 space-y-2" style={cardStyle}>
          <p className="text-sm font-semibold">분석 완료</p>
          <div className="flex gap-4 text-sm">
            <span style={{ color: "#ef4444" }}>✗ 오답 저장 {savedCount}개</span>
            <span style={{ color: "#f59e0b" }}>⚡ 최적화 후보 {optimizeCandidates.length}개</span>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            오답정리 페이지에서 확인하세요.
          </p>
        </div>
      )}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────
export function MathHelperClient() {
  const [tab, setTab] = useState<"analysis" | "exam">("analysis");

  const tabs = [
    { key: "analysis" as const, label: "문제 분석" },
    { key: "exam" as const, label: "모의고사 분석" },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">AI 수학 도우미</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          문제 사진을 올리면 AI가 풀이·검토·개념·최적화를 한번에 분석합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex rounded-xl border p-1 gap-1" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === key ? "var(--card)" : "transparent",
              color: tab === key ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "analysis" ? <AnalysisTab /> : <ExamTab />}
    </div>
  );
}
