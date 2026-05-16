"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { InlineMath, BlockMath } from "react-katex";
import { Upload, Camera, Crop, X, RotateCcw, Zap, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Mode } from "@/app/api/math-helper/route";

// ── 모드 설정 ──────────────────────────────────────────────────
const MODES: { key: Mode; label: string; emoji: string; desc: string }[] = [
  { key: "stuck", label: "풀다 멈춤", emoji: "✏️", desc: "막힌 지점부터 단계별 풀이 이어주기" },
  { key: "review", label: "검토", emoji: "🔍", desc: "풀이 논리 검증 + 틀린 부분 지적" },
  { key: "concept", label: "개념 설명", emoji: "📖", desc: "사용된 단원·공식·정리 상세 설명" },
  { key: "optimize", label: "풀이 최적화", emoji: "⚡", desc: "더 빠르고 짧은 풀이로 다듬기" },
];

// ── 이미지 리사이즈 (canvas) ──────────────────────────────────
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
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── 크롭 영역을 잘라내기 ──────────────────────────────────────
async function cropImage(
  imageSrc: string,
  pixelCrop: Area,
  quality = 0.85
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      canvas
        .getContext("2d")!
        .drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

// ── KaTeX 렌더러 ──────────────────────────────────────────────
// 텍스트를 파싱해 일반 텍스트 / 인라인 수식($...$) / 블록 수식($$...$$) 분리 렌더링
function MathRenderer({ text }: { text: string }) {
  // $$...$$ 블록 먼저 분리, 그 다음 $...$ 인라인 분리
  const parts = splitMath(text);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === "block") {
          return (
            <span key={i} className="block my-2">
              <BlockMath math={part.content} />
            </span>
          );
        }
        if (part.type === "inline") {
          return <InlineMath key={i} math={part.content} />;
        }
        // 일반 텍스트 (줄바꿈 처리)
        return (
          <span key={i}>
            {part.content.split("\n").map((line, j, arr) => (
              <span key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

type MathPart = { type: "text" | "inline" | "block"; content: string };

function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = [];
  // $$...$$ 블록 우선 처리
  const blockRe = /\$\$([\s\S]*?)\$\$/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(text)) !== null) {
    if (match.index > last) {
      splitInline(text.slice(last, match.index), parts);
    }
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

// ── 최적화 모드 섹션 카드 분리 렌더러 ──────────────────────────
const OPTIMIZE_SECTIONS = [
  { key: "현재 풀이 분석", color: "#3b82f6" },
  { key: "비효율 지점", color: "#f59e0b" },
  { key: "최적화 풀이", color: "#10b981" },
  { key: "시간 비교", color: "#8b5cf6" },
  { key: "수능 팁", color: "#ef4444" },
];

function OptimizeResponse({ text }: { text: string }) {
  const sections: { title: string; content: string; color: string }[] = [];
  let remaining = text;

  for (let i = 0; i < OPTIMIZE_SECTIONS.length; i++) {
    const { key, color } = OPTIMIZE_SECTIONS[i];
    const header = `[${key}]`;
    const idx = remaining.indexOf(header);
    if (idx === -1) continue;

    const nextHeaders = OPTIMIZE_SECTIONS.slice(i + 1).map((s) => `[${s.key}]`);
    let end = remaining.length;
    for (const nh of nextHeaders) {
      const ni = remaining.indexOf(nh, idx + header.length);
      if (ni !== -1 && ni < end) end = ni;
    }

    sections.push({
      title: key,
      content: remaining.slice(idx + header.length, end).trim(),
      color,
    });
  }

  // 섹션 파싱 전 앞부분 텍스트 (개요 등)
  const firstIdx = sections.length > 0 ? text.indexOf(`[${sections[0].title}]`) : text.length;
  const intro = text.slice(0, firstIdx).trim();

  return (
    <div className="space-y-3">
      {intro && (
        <p className="text-sm" style={{ color: "var(--foreground)" }}>
          <MathRenderer text={intro} />
        </p>
      )}
      {sections.map(({ title, content, color }) => (
        <div
          key={title}
          className="rounded-xl border p-4"
          style={{ borderColor: color, borderLeftWidth: 4, background: "var(--muted)" }}
        >
          <p className="text-xs font-bold mb-2" style={{ color }}>
            {title}
          </p>
          <div className="text-sm whitespace-pre-wrap">
            <MathRenderer text={content} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export function MathHelperClient() {
  const [mode, setMode] = useState<Mode>("stuck");
  const [rawImage, setRawImage] = useState<string | null>(null); // 원본 data URL (크롭용)
  const [finalImage, setFinalImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [hint, setHint] = useState("");
  const [response, setResponse] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  // 크롭 상태
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 응답 스트리밍 중 자동 스크롤
  useEffect(() => {
    if (streaming && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [response, streaming]);

  // 파일 선택 핸들러
  const handleFile = useCallback(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("jpeg, png, webp 이미지만 허용됩니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("이미지 크기는 최대 10MB입니다.");
      return;
    }
    setError("");
    setResponse("");
    const { base64, mimeType } = await resizeImage(file);
    setRawImage(`data:${mimeType};base64,${base64}`);
    setFinalImage({ base64, mimeType });
    setCropping(false);
  }, []);

  // 드래그앤드롭
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // 크롭 완료
  const handleCropDone = useCallback(async () => {
    if (!rawImage || !croppedAreaPixels) return;
    const cropped = await cropImage(rawImage, croppedAreaPixels);
    setFinalImage(cropped);
    setCropping(false);
  }, [rawImage, croppedAreaPixels]);

  // AI 요청
  const handleSubmit = useCallback(async () => {
    if (!finalImage) { setError("이미지를 먼저 업로드해주세요."); return; }
    if (streaming) {
      abortRef.current?.abort();
      setStreaming(false);
      return;
    }

    setError("");
    setResponse("");
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/math-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, imageBase64: finalImage.base64, mimeType: finalImage.mimeType, hint: hint || undefined }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        setError(msg);
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setResponse(buf);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("요청 중 오류가 발생했습니다.");
      }
    } finally {
      setStreaming(false);
    }
  }, [finalImage, mode, hint, streaming]);

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span>AI 수학 도우미</span>
          <span className="text-lg">✨</span>
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          풀이 사진을 올리면 AI가 도와드립니다.
        </p>
      </div>

      {/* 모드 탭 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODES.map(({ key, label, emoji, desc }) => (
          <button
            key={key}
            onClick={() => { setMode(key); setResponse(""); }}
            className="rounded-xl border p-3 text-left transition-all"
            style={{
              borderColor: mode === key ? "var(--primary)" : "var(--border)",
              background: mode === key ? "color-mix(in srgb, var(--primary) 10%, var(--card))" : "var(--card)",
            }}
          >
            <p className="text-base">{emoji}</p>
            <p className="text-sm font-semibold mt-1">{label}</p>
            <p className="text-xs mt-0.5 leading-tight" style={{ color: "var(--muted-foreground)" }}>{desc}</p>
          </button>
        ))}
      </div>

      {/* 이미지 업로드 영역 */}
      {!rawImage ? (
        <div
          className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-4 cursor-pointer transition-colors"
          style={{ borderColor: "var(--border)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--muted)" }}>
            <Upload size={24} style={{ color: "var(--primary)" }} />
          </div>
          <div className="text-center">
            <p className="font-medium">풀이 사진을 드래그하거나 클릭해서 업로드</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
              jpeg / png / webp · 최대 10MB
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            onClick={(e) => {
              e.stopPropagation();
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.capture = "environment";
              input.onchange = (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            <Camera size={16} />
            카메라로 촬영
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : cropping ? (
        /* 크롭 UI */
        <div className="rounded-xl border overflow-hidden" style={cardStyle}>
          <div className="relative w-full" style={{ height: 320, background: "#000" }}>
            <Cropper
              image={rawImage}
              crop={crop}
              zoom={zoom}
              aspect={undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
            />
          </div>
          <div className="flex items-center gap-3 p-3">
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
            <Button size="sm" onClick={handleCropDone}>
              <Crop size={14} className="mr-1" /> 잘라내기 완료
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCropping(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        /* 이미지 미리보기 */
        <div className="rounded-xl border p-3 flex gap-3 items-start" style={cardStyle}>
          <img
            src={`data:${finalImage?.mimeType};base64,${finalImage?.base64}`}
            alt="풀이 미리보기"
            className="w-32 h-24 object-cover rounded-lg flex-shrink-0"
            style={{ border: "1px solid var(--border)" }}
          />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">이미지 업로드 완료</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCropping(true)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{ background: "var(--muted)", color: "var(--foreground)" }}
              >
                <Crop size={12} /> 잘라내기
              </button>
              <button
                onClick={() => { setRawImage(null); setFinalImage(null); setResponse(""); }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{ background: "var(--muted)", color: "var(--foreground)" }}
              >
                <X size={12} /> 제거
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 힌트 입력 */}
      {rawImage && (
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            어디서 막혔는지 한 줄로 (선택)
          </label>
          <Textarea
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder={
              mode === "stuck" ? "예: 3번째 줄까지 썼는데 다음을 모르겠어요" :
              mode === "optimize" ? "예: 이분법 말고 더 빠른 방법이 있나요?" :
              "추가로 알고 싶은 것이 있으면 입력하세요"
            }
            rows={2}
            style={{ background: "var(--muted)", borderColor: "var(--border)" }}
          />
        </div>
      )}

      {/* 에러 */}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>
          {error}
        </p>
      )}

      {/* 제출 버튼 */}
      {finalImage && !cropping && (
        <Button
          onClick={handleSubmit}
          disabled={!finalImage}
          className="w-full"
          style={streaming ? { background: "var(--destructive)", color: "#fff" } : {}}
        >
          {streaming ? (
            <>
              <X size={16} className="mr-2" /> 중단
            </>
          ) : (
            <>
              {mode === "optimize" ? <Zap size={16} className="mr-2" /> : <Send size={16} className="mr-2" />}
              {MODES.find((m) => m.key === mode)?.label} 요청
            </>
          )}
        </Button>
      )}

      {/* 응답 영역 */}
      {(response || streaming) && (
        <div ref={responseRef} className="rounded-xl border p-5 space-y-3" style={cardStyle}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
              {MODES.find((m) => m.key === mode)?.emoji} AI 응답
              {streaming && <span className="ml-2 animate-pulse">●</span>}
            </p>
            {response && !streaming && (
              <button
                onClick={() => { setResponse(""); }}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
              >
                <RotateCcw size={12} /> 다른 풀이 보여줘
              </button>
            )}
          </div>

          <div className="text-sm leading-relaxed">
            {mode === "optimize" ? (
              <OptimizeResponse text={response} />
            ) : (
              <div className="whitespace-pre-wrap">
                <MathRenderer text={response} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
