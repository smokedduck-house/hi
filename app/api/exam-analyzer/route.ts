import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `수능 수학 AI. 이미지의 수학 문제를 분석해서 아래 JSON만 출력해. 코드블록(\`\`\`) 절대 금지.

{
  "problemText": "문제 전문 (LaTeX 수식 변환, 조건·보기 포함)",
  "solution": "단계별 완전한 풀이 (LaTeX 수식, 최종 답 포함)",
  "concept": "핵심 개념·공식 1~2줄",
  "isOptimizable": true,
  "optimizeTip": "더 빠른 풀이 방법 (isOptimizable=true일 때만, 없으면 빈 문자열)"
}

규칙:
- isOptimizable: 현재 풀이보다 명백히 빠른 방법이 있으면 true
- 문제가 이미지에 없고 풀이만 있으면 problemText는 빈 문자열
- 순수 JSON만. 다른 텍스트 금지.`;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_API_KEY 없음" }, { status: 500 });

  let body: { imageBase64: string; mimeType: string; problemNum?: number; examSource?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "요청 형식 오류" }, { status: 400 }); }

  const { imageBase64, mimeType } = body;

  if (!ALLOWED_MIME.has(mimeType))
    return NextResponse.json({ error: "jpeg, png, webp만 허용됩니다." }, { status: 400 });
  if (Buffer.from(imageBase64, "base64").byteLength > MAX_IMAGE_BYTES)
    return NextResponse.json({ error: "이미지 최대 10MB." }, { status: 400 });

  const ai = new GoogleGenAI({ apiKey });

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 2000, temperature: 0.2 },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: "분석해줘." }] }],
    });
    const raw = result.text ?? "";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      problemText: string;
      solution: string;
      concept: string;
      isOptimizable: boolean;
      optimizeTip: string;
    };
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: "AI 분석 실패", detail: String(err) }, { status: 500 });
  }
}
