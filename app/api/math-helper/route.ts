import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export type Mode = "stuck" | "review" | "concept" | "optimize";

const MODEL = "gemini-2.0-flash-lite";

const MAX_TOKENS: Record<Mode, number> = {
  stuck: 1200,
  review: 800,
  concept: 900,
  optimize: 1000,
};

const TEMPERATURE: Record<Mode, number> = {
  stuck: 0.5,
  review: 0.3,
  concept: 0.4,
  optimize: 0.3,
};

// ── 시스템 프롬프트 ───────────────────────────────────────────
const BASE = `수능 수학 튜터. 한국어. 수식은 LaTeX($...$). 불명확한 글씨는 추측 말고 확인 요청.`;

const MODE_PROMPT: Record<Mode, string> = {
  stuck: `${BASE}
막힌 지점 파악 후 풀이 이어서 작성. 각 단계: 이유 1줄 + 수식. 최종 답 명시. 주의할 함정 1가지.`,

  review: `${BASE}
풀이 단계별 검증. 오류: 몇 번째 줄, 무엇이 틀렸는지, 수정식. 맞으면 "정확합니다" 한 줄로 끝.`,

  concept: `${BASE}
사용 개념·공식 설명. 공식과 사용 조건, 수능 빈출 변형 패턴 2가지. 예시 수식 포함.`,

  optimize: `${BASE}
더 빠른 풀이 제안. 형식: [현재 접근 1줄] → [비효율 지점] → [최적화 풀이(수식)] → [시간 단축 요약]. 이미 최적이면 솔직히 말할 것.`,
};

// ── IP 기반 일일 호출 제한 ────────────────────────────────────
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT ?? "30", 10);
const ipCounts = new Map<string, { count: number; date: string }>();

function checkRateLimit(ip: string): boolean {
  if (!RATE_LIMIT_ENABLED) return true;
  const today = new Date().toISOString().slice(0, 10);
  const record = ipCounts.get(ip);
  if (!record || record.date !== today) { ipCounts.set(ip, { count: 1, date: today }); return true; }
  if (record.count >= DAILY_LIMIT) return false;
  record.count++;
  return true;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// ── API 라우트 ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return new Response("GOOGLE_API_KEY가 설정되지 않았습니다.", { status: 500 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkRateLimit(ip)) return new Response("일일 호출 한도를 초과했습니다.", { status: 429 });

  let body: { mode: Mode; imageBase64: string; mimeType: string; hint?: string };
  try { body = await req.json(); }
  catch { return new Response("요청 형식이 올바르지 않습니다.", { status: 400 }); }

  const { mode, imageBase64, mimeType, hint } = body;

  if (!["stuck", "review", "concept", "optimize"].includes(mode))
    return new Response("유효하지 않은 모드입니다.", { status: 400 });
  if (!ALLOWED_MIME.has(mimeType))
    return new Response("jpeg, png, webp만 허용됩니다.", { status: 400 });
  if (Buffer.from(imageBase64, "base64").byteLength > MAX_IMAGE_BYTES)
    return new Response("이미지 최대 10MB.", { status: 400 });

  const ai = new GoogleGenAI({ apiKey });
  const userText = hint ? `[메모] ${hint}\n풀이 분석해줘.` : "풀이 분석해줘.";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await ai.models.generateContentStream({
          model: MODEL,
          config: {
            systemInstruction: MODE_PROMPT[mode],
            maxOutputTokens: MAX_TOKENS[mode],
            temperature: TEMPERATURE[mode],
          },
          contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: userText }] }],
        });
        for await (const chunk of response) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n[오류] ${err instanceof Error ? err.message : "알 수 없는 오류"}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
  });
}
