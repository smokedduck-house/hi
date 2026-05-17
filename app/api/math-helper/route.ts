import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite";

// ── 통합 분석 프롬프트 ────────────────────────────────────────
const SYSTEM_PROMPT = `수능 수학 AI 튜터. 한국어. 수식은 LaTeX($...$). 불명확한 글씨는 추측 말고 확인 요청.

이미지를 분석해서 아래 순서대로 답해. 섹션 헤더([풀이] 등)는 반드시 그대로 포함.

이미지에 문제 텍스트가 있으면 아래 블록으로 먼저 추출 (풀이만 있고 문제가 없으면 생략):
---PROBLEM_TEXT_START---
[문제 전문, LaTeX 수식 변환 포함]
---PROBLEM_TEXT_END---

[풀이]
막힌 부분 파악 후 단계별 완전한 풀이 작성. 각 단계 이유 1줄 + 수식. 최종 답 명시.

[검토]
풀이 각 단계 논리 검증. 오류: 위치 + 무엇이 틀렸는지 + 수정식. 오류 없으면 "정확합니다." 한 줄로 끝.

[개념]
사용된 핵심 개념·공식과 적용 조건. 수능 빈출 변형 패턴 1가지.

[최적화]
더 빠른 풀이가 있으면 구체적으로 제시. 없으면 "현재 풀이가 최적입니다." 한 줄로 끝.`;

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

  let body: { imageBase64: string; mimeType: string; hint?: string };
  try { body = await req.json(); }
  catch { return new Response("요청 형식이 올바르지 않습니다.", { status: 400 }); }

  const { imageBase64, mimeType, hint } = body;

  if (!ALLOWED_MIME.has(mimeType))
    return new Response("jpeg, png, webp만 허용됩니다.", { status: 400 });
  if (Buffer.from(imageBase64, "base64").byteLength > MAX_IMAGE_BYTES)
    return new Response("이미지 최대 10MB.", { status: 400 });

  const ai = new GoogleGenAI({ apiKey });
  const userText = hint ? `[참고] ${hint}\n분석해줘.` : "분석해줘.";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await ai.models.generateContentStream({
          model: MODEL,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            maxOutputTokens: 2500,
            temperature: 0.3,
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
