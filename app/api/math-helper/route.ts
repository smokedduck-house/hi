import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

// ── 모드 정의 ────────────────────────────────────────────────
export type Mode = "stuck" | "review" | "concept" | "optimize";

const MODEL: Record<Mode, string> = {
  stuck: "gemini-2.5-pro",
  optimize: "gemini-2.5-pro",
  review: "gemini-2.5-flash",
  concept: "gemini-2.5-flash",
};

const MAX_TOKENS: Record<Mode, number> = {
  stuck: 2500,
  optimize: 2500,
  review: 1500,
  concept: 1500,
};

const TEMPERATURE: Record<Mode, number> = {
  stuck: 0.7,
  optimize: 0.3,
  review: 0.7,
  concept: 0.5,
};

// ── 시스템 프롬프트 ───────────────────────────────────────────
const BASE_PROMPT = `당신은 한국 수능 수학 전문 튜터입니다.
학생이 업로드한 손글씨 풀이 사진을 분석해 답변하세요.

규칙:
1. 문제를 한 줄 요약 + 단원·개념 식별 (예: "공통-수열-등차수열의 일반항")
2. 수식은 LaTeX로 작성 ($...$ 또는 $$...$$)
3. 한국어, 친근하지만 명확한 어조
4. 틀린 부분은 비난 없이 구체적으로 짚기
5. 글씨가 흐리면 추측하지 말고 "이 부분이 ○○로 보이는데 맞나요?" 되묻기
6. 수학 문제가 아니거나 사진이 불명확하면 정중히 재요청`;

const MODE_PROMPT: Record<Mode, string> = {
  stuck: `${BASE_PROMPT}

학생 풀이를 확인 후 막힌 지점부터 이어서 풀이를 작성하세요.
각 단계마다 '왜 이렇게 하는가' 직관 설명 1줄 + 식 전개 포함.
최종 답 명시, 마지막에 비슷한 유형의 함정 1가지 알려주기.`,

  review: `${BASE_PROMPT}

각 단계를 논리적으로 검증하세요.
틀린 단계는 정확히 어느 줄, 어떤 부분인지 짚고 수정안 제시.
맞으면 확정하고, 더 좋은 풀이가 있으면 간략히 언급만.`,

  concept: `${BASE_PROMPT}

풀이보다 사용된 개념·공식·정리를 자세히 설명하세요.
공식 유도 과정, 사용 조건, 자주 나오는 변형 패턴 정리.
이 개념이 적용되는 다른 유형 1~2개 예시.`,

  optimize: `${BASE_PROMPT}

학생의 풀이는 맞다고 가정하고 더 빠른 풀이를 제안하세요.
다음 형식을 따르세요:

[현재 풀이 분석]
- 사용한 접근:
- 소요 단계: 약 N단계
- 예상 시간: 약 X분

[비효율 지점]
- 어느 단계에서 어떤 비효율이 있는지 구체적으로

[최적화 풀이]
- 단계별 풀이 (왜 빠른가 1줄 + 수식)

[시간 비교]
기존 약 X분 → 최적화 약 Y분

[수능 팁]
- 객관식 선지 활용법
- 빈출 패턴명
- 다음에 바로 쓸 수 있는 한 줄 요령

학생 풀이가 이미 최적에 가까우면 솔직히 말하고,
변형 문제에서 더 줄일 수 있는 확장 팁 제공.`,
};

// ── IP 기반 일일 호출 제한 ────────────────────────────────────
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT ?? "30", 10);

const ipCounts = new Map<string, { count: number; date: string }>();

function checkRateLimit(ip: string): boolean {
  if (!RATE_LIMIT_ENABLED) return true;
  const today = new Date().toISOString().slice(0, 10);
  const record = ipCounts.get(ip);
  if (!record || record.date !== today) {
    ipCounts.set(ip, { count: 1, date: today });
    return true;
  }
  if (record.count >= DAILY_LIMIT) return false;
  record.count++;
  return true;
}

// ── 이미지 유효성 검사 ────────────────────────────────────────
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── API 라우트 ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return new Response("GOOGLE_API_KEY가 설정되지 않았습니다.", { status: 500 });
  }

  // IP 기반 레이트 리밋
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!checkRateLimit(ip)) {
    return new Response("일일 호출 한도를 초과했습니다. 내일 다시 시도해주세요.", { status: 429 });
  }

  let body: { mode: Mode; imageBase64: string; mimeType: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("요청 형식이 올바르지 않습니다.", { status: 400 });
  }

  const { mode, imageBase64, mimeType, hint } = body;

  // 모드 검증
  if (!["stuck", "review", "concept", "optimize"].includes(mode)) {
    return new Response("유효하지 않은 모드입니다.", { status: 400 });
  }

  // 이미지 검증
  if (!ALLOWED_MIME.has(mimeType)) {
    return new Response("jpeg, png, webp 이미지만 허용됩니다.", { status: 400 });
  }
  const imageBytes = Buffer.from(imageBase64, "base64").byteLength;
  if (imageBytes > MAX_IMAGE_BYTES) {
    return new Response("이미지 크기는 최대 10MB입니다.", { status: 400 });
  }

  // Gemini 호출
  const ai = new GoogleGenAI({ apiKey });

  const userText = hint
    ? `[학생 메모] ${hint}\n\n위 사진의 풀이를 분석해주세요.`
    : "위 사진의 풀이를 분석해주세요.";

  const contents = [
    {
      role: "user" as const,
      parts: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: userText },
      ],
    },
  ];

  // 스트리밍 응답
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await ai.models.generateContentStream({
          model: MODEL[mode],
          config: {
            systemInstruction: MODE_PROMPT[mode],
            maxOutputTokens: MAX_TOKENS[mode],
            temperature: TEMPERATURE[mode],
          },
          contents,
        });

        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류";
        controller.enqueue(encoder.encode(`\n\n[오류] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
