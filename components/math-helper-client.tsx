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
type ExamResult = {
  problemNum: string;
  isWrong: boolean;
  wrongReason: string;
  problemText: string;
  solution: string;
  concept: string;
  isOptimizable: boolean;
  optimizeTip: string;
};

type ProblemEntry = {
  id: string;
  image: { base64: string; mimeType: string } | null;
  status: "idle" | "analyzing" | "done" | "error";
  results?: ExamResult[];  // 사진 1장에 여러 문제 가능
  savedIds?: Array<{ odapId?: string; optId?: string }>;
  errorMsg?: string;
  expanded: boolean;
};

function ExamTab() {
  const [examSource, setExamSource] = useState("");
  const [problems, setProblems] = useState<ProblemEntry[]>([
    { id: crypto.randomUUID(), image: null, status: "idle", expanded: true },
  ]);
  const [analyzing, setAnalyzing] = useState(false);

  function addProblem() {
    setProblems((p) => [...p, { id: crypto.randomUUID(), image: null, status: "idle", expanded: true }]);
  }

  // 여러 파일을 한번에 드롭/선택 → 자동으로 문제 슬롯 추가
  function handleMultiFiles(files: File[]) {
    const valid = files.filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (valid.length === 0) return;

    setProblems((prev) => {
      // 빈 슬롯이 있으면 먼저 채우고, 모자라면 새로 추가
      const next = [...prev];
      let fileIdx = 0;
      for (let i = 0; i < next.length && fileIdx < valid.length; i++) {
        if (!next[i].image) {
          // 비동기 resizeImage를 여기서 호출할 수 없으니 placeholder 표시 후 useEffect에서 처리
          next[i] = { ...next[i], status: "idle" };
          fileIdx++;
        }
      }
      // 남은 파일들은 새 슬롯
      while (fileIdx < valid.length) {
        next.push({ id: crypto.randomUUID(), image: null, status: "idle", expanded: true });
        fileIdx++;
      }
      return next;
    });

    // 실제 리사이즈는 순서대로 처리
    (async () => {
      setProblems((prev) => {
        const emptySlots = prev.filter((p) => !p.image);
        const toFill = Math.min(emptySlots.length, valid.length);
        // mark로 구분하기 위해 id 배열 추출
        return prev;
      });

      // 간단하게: 현재 빈 슬롯 id 목록 가져와서 파일 매칭
      setProblems((prev) => {
        const result = [...prev];
        const emptyIds = result.filter((p) => !p.image).map((p) => p.id);
        const promises: Promise<void>[] = [];
        valid.forEach((file, i) => {
          const targetId = emptyIds[i];
          if (!targetId) return;
          const p = resizeImage(file).then((img) => {
            setProblems((cur) => cur.map((x) => x.id === targetId ? { ...x, image: img } : x));
          });
          promises.push(p);
        });
        return result;
      });

      // 위 방식으로는 setProblems 내부에서 async가 어려우니 직접 처리
      const emptyIds: string[] = [];
      setProblems((prev) => {
        prev.filter((p) => !p.image).forEach((p) => emptyIds.push(p.id));
        return prev;
      });
      for (let i = 0; i < valid.length && i < emptyIds.length; i++) {
        const img = await resizeImage(valid[i]);
        const id = emptyIds[i];
        setProblems((prev) => prev.map((x) => x.id === id ? { ...x, image: img } : x));
      }
    })();
  }

  async function handleFileForProblem(id: string, file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    const image = await resizeImage(file);
    setProblems((p) => p.map((x) => x.id === id ? { ...x, image } : x));
  }

  function removeProblem(id: string) {
    setProblems((p) => p.filter((x) => x.id !== id));
  }

  async function analyzeAll() {
    const toAnalyze = problems.filter((p) => p.image && p.status !== "done");
    if (toAnalyze.length === 0) return;

    setAnalyzing(true);
    const doneCount = { current: 0 };

    for (const prob of toAnalyze) {
      setProblems((p) => p.map((x) => x.id === prob.id ? { ...x, status: "analyzing" } : x));

      try {
        const res = await fetch("/api/exam-analyzer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: prob.image!.base64, mimeType: prob.image!.mimeType }),
        });

        if (!res.ok) {
          setProblems((p) => p.map((x) => x.id === prob.id ? { ...x, status: "error", errorMsg: "분석 실패" } : x));
          continue;
        }

        const results = await res.json() as ExamResult[];
        const savedIds: Array<{ odapId?: string; optId?: string }> = [];

        for (const result of results) {
          const numLabel = result.problemNum || "";
          const sourceLabel = [examSource || "모의고사", numLabel ? `${numLabel}번` : ""].filter(Boolean).join(" ");
          let odapId: string | undefined;
          let optId: string | undefined;

          // AI가 틀렸다고 판단 → 오답정리 자동 저장
          if (result.isWrong) {
            const saveRes = await fetch("/api/math-problems", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source: sourceLabel,
                problem: result.problemText,
                aiNote: `[틀린 이유]\n${result.wrongReason}\n\n[올바른 풀이]\n${result.solution}\n\n[개념]\n${result.concept}`,
                category: "오답",
              }),
            });
            odapId = (await saveRes.json()).id;
          }

          // AI가 최적화 가능하다고 판단 → 최적화 후보 저장
          if (result.isOptimizable) {
            const saveRes = await fetch("/api/math-problems", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source: sourceLabel,
                problem: result.problemText,
                aiNote: `[최적화 팁]\n${result.optimizeTip}\n\n[개념]\n${result.concept}`,
                category: "최적화",
              }),
            });
            optId = (await saveRes.json()).id;
          }

          savedIds.push({ odapId, optId });
        }

        doneCount.current++;
        setProblems((p) => p.map((x) =>
          x.id === prob.id ? { ...x, status: "done", results, savedIds, expanded: true } : x
        ));
      } catch {
        setProblems((p) => p.map((x) => x.id === prob.id ? { ...x, status: "error", errorMsg: "네트워크 오류" } : x));
      }
    }

    setAnalyzing(false);
  }

  const doneProblems = problems.filter((p) => p.status === "done");
  const allResults = doneProblems.flatMap((p) => p.results ?? []);
  const wrongCount = allResults.filter((r) => r.isWrong).length;
  const optCount = allResults.filter((r) => r.isOptimizable).length;
  const hasImages = problems.some((p) => p.image);
  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };
  const totalToAnalyze = problems.filter((p) => p.image && p.status !== "done").length;
  const currentDone = problems.filter((p) => p.status === "done").length;

  return (
    <div className="space-y-5">
      {/* 시험명 */}
      <div className="space-y-1">
        <label className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>시험명 (선택)</label>
        <Input value={examSource} onChange={(e) => setExamSource(e.target.value)}
          placeholder="예: 2026 수능 수학, 6월 모평" style={{ background: "var(--muted)", borderColor: "var(--border)" }} />
      </div>

      {/* 한번에 여러 장 업로드 드롭존 */}
      <div
        className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer"
        style={{ borderColor: "var(--border)" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleMultiFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file"; input.accept = "image/*"; input.multiple = true;
          input.onchange = (ev) => {
            const files = Array.from((ev.target as HTMLInputElement).files ?? []);
            handleMultiFiles(files);
          };
          input.click();
        }}
      >
        <Upload size={20} className="mx-auto mb-2" style={{ color: "var(--primary)" }} />
        <p className="text-sm font-medium">여러 장 한번에 드래그하거나 클릭</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
          AI가 각 사진을 보고 정오(正誤)·최적화 여부를 스스로 판단합니다
        </p>
      </div>

      {/* 문제 카드 목록 */}
      {problems.filter((p) => p.image).length > 0 && (
        <div className="space-y-2">
          {problems.map((prob, idx) => {
            if (!prob.image && prob.status === "idle") return null;
            const results = prob.results ?? [];
            const wrongInPhoto = results.filter((r) => r.isWrong).length;
            const optInPhoto = results.filter((r) => r.isOptimizable).length;
            return (
              <div key={prob.id} className="rounded-xl border" style={cardStyle}>
                <div className="flex items-center gap-2 p-3">
                  <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--muted-foreground)" }}>
                    {idx + 1}
                  </span>

                  {/* 상태 뱃지 */}
                  <div className="flex gap-1.5 flex-1 flex-wrap">
                    {prob.status === "analyzing" && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                        <Loader2 size={10} className="animate-spin" /> 분석 중
                      </span>
                    )}
                    {prob.status === "done" && results.length > 0 && (
                      <>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                          {results.length}문제 감지
                        </span>
                        {wrongInPhoto > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            ✗ 오답 {wrongInPhoto}개
                          </span>
                        )}
                        {optInPhoto > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                            ⚡ 최적화 {optInPhoto}개
                          </span>
                        )}
                        {wrongInPhoto === 0 && optInPhoto === 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                            ✓ 전부 정답
                          </span>
                        )}
                      </>
                    )}
                    {prob.status === "error" && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                        오류
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => setProblems((p) => p.map((x) => x.id === prob.id ? { ...x, expanded: !x.expanded } : x))}
                      className="p-1" style={{ color: "var(--muted-foreground)" }}>
                      {prob.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => removeProblem(prob.id)} className="p-1" style={{ color: "var(--muted-foreground)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {prob.expanded && (
                  <div className="px-3 pb-3 border-t space-y-3 pt-3" style={{ borderColor: "var(--border)" }}>
                    {/* 이미지 썸네일 */}
                    {prob.image && (
                      <div className="flex items-center gap-2">
                        <img src={`data:${prob.image.mimeType};base64,${prob.image.base64}`} alt="문제"
                          className="w-24 object-cover rounded" style={{ border: "1px solid var(--border)", maxHeight: 96 }} />
                        {prob.status === "idle" && (
                          <button onClick={() => setProblems((p) => p.map((x) => x.id === prob.id ? { ...x, image: null } : x))}
                            className="text-xs px-2 py-1 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                            <X size={10} className="inline mr-1" />제거
                          </button>
                        )}
                      </div>
                    )}

                    {/* 분석 결과 - 문제별로 표시 */}
                    {prob.status === "done" && results.map((result, ri) => (
                      <div key={ri} className="rounded-lg border space-y-2 p-2.5 text-xs" style={{ borderColor: "var(--border)" }}>
                        <p className="font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {result.problemNum ? `${result.problemNum}번 문제` : `문제 ${ri + 1}`}
                          {result.isWrong
                            ? <span className="ml-2 font-medium" style={{ color: "#ef4444" }}>✗ 틀림</span>
                            : <span className="ml-2" style={{ color: "#10b981" }}>✓ 정답</span>
                          }
                          {result.isOptimizable && <span className="ml-2" style={{ color: "#f59e0b" }}>⚡ 최적화</span>}
                        </p>
                        {result.isWrong && result.wrongReason && (
                          <div className="rounded-lg p-2" style={{ background: "rgba(239,68,68,0.07)", borderLeft: "3px solid #ef4444" }}>
                            <p className="font-bold mb-1" style={{ color: "#ef4444" }}>틀린 이유</p>
                            <p className="whitespace-pre-wrap">{result.wrongReason}</p>
                          </div>
                        )}
                        {result.problemText && (
                          <div className="rounded-lg p-2" style={{ background: "rgba(59,130,246,0.07)", borderLeft: "3px solid #3b82f6" }}>
                            <p className="font-bold mb-1" style={{ color: "#3b82f6" }}>문제</p>
                            <MathRenderer text={result.problemText} />
                          </div>
                        )}
                        {result.isWrong && result.solution && (
                          <div className="rounded-lg p-2" style={{ background: "var(--muted)" }}>
                            <p className="font-bold mb-1" style={{ color: "#10b981" }}>올바른 풀이</p>
                            <div className="whitespace-pre-wrap"><MathRenderer text={result.solution} /></div>
                          </div>
                        )}
                        {result.concept && (
                          <div className="rounded-lg p-2" style={{ background: "var(--muted)" }}>
                            <p className="font-bold mb-1" style={{ color: "#8b5cf6" }}>개념</p>
                            <p className="whitespace-pre-wrap">{result.concept}</p>
                          </div>
                        )}
                        {result.isOptimizable && result.optimizeTip && (
                          <div className="rounded-lg p-2" style={{ background: "rgba(245,158,11,0.07)", borderLeft: "3px solid #f59e0b" }}>
                            <p className="font-bold mb-1" style={{ color: "#f59e0b" }}>⚡ 최적화</p>
                            <div className="whitespace-pre-wrap"><MathRenderer text={result.optimizeTip} /></div>
                          </div>
                        )}
                      </div>
                    ))}
                    {prob.status === "error" && (
                      <p className="text-xs px-2 py-1.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>
                        {prob.errorMsg}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={addProblem}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border w-full justify-center"
            style={{ borderColor: "var(--border)", borderStyle: "dashed", color: "var(--muted-foreground)" }}>
            <Plus size={14} /> 문제 추가
          </button>
        </div>
      )}

      {/* 분석 버튼 */}
      {hasImages && (
        <Button onClick={analyzeAll} disabled={analyzing || totalToAnalyze === 0} className="w-full">
          {analyzing
            ? <><Loader2 size={16} className="mr-2 animate-spin" />AI 분석 중... ({currentDone}/{currentDone + totalToAnalyze})</>
            : <>AI 자동 분류 시작 · {totalToAnalyze}장</>
          }
        </Button>
      )}

      {/* 완료 요약 */}
      {doneProblems.length > 0 && !analyzing && (
        <div className="rounded-xl border p-4 space-y-2" style={cardStyle}>
          <p className="text-sm font-semibold">분석 결과</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg p-2" style={{ background: "var(--muted)" }}>
              <p className="text-lg font-bold">{allResults.length}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>분석 완료</p>
            </div>
            <div className="rounded-lg p-2" style={{ background: "rgba(239,68,68,0.07)" }}>
              <p className="text-lg font-bold" style={{ color: "#ef4444" }}>{wrongCount}</p>
              <p className="text-xs" style={{ color: "#ef4444" }}>오답 저장</p>
            </div>
            <div className="rounded-lg p-2" style={{ background: "rgba(245,158,11,0.07)" }}>
              <p className="text-lg font-bold" style={{ color: "#f59e0b" }}>{optCount}</p>
              <p className="text-xs" style={{ color: "#f59e0b" }}>최적화 저장</p>
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>오답정리 페이지에서 확인하세요.</p>
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
