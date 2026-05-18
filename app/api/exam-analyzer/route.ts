import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-flash-lite";

// AI가 정오(正誤)·최적화 여부를 스스로 판단 (사진 1장에 여러 문제 가능)
const SYSTEM_PROMPT = `수능 수학 AI. 학생이 직접 풀이한 시험지 사진을 보고 사진에 있는 모든 문제를 분석해. 코드블록(\`\`\`) 절대 금지.

사진에서 문제를 모두 찾아 아래 형식의 JSON 배열로 출력해. 문제가 1개여도 배열로 출력해.

[
  {
    "problemNum": "문제 번호 (읽히면 숫자, 없으면 빈 문자열)",
    "isWrong": true/false,
    "wrongReason": "틀린 이유 한 줄 (isWrong=false이면 빈 문자열)",
    "problemText": "문제 전문 LaTeX (문제가 이미지에 없으면 빈 문자열)",
    "solution": "올바른 정답 풀이 LaTeX (isWrong=true이면 상세하게, false이면 빈 문자열)",
    "concept": "사용된 핵심 개념·공식 1~2줄",
    "isOptimizable": true/false,
    "optimizeTip": "더 빠른 풀이 방법 (isOptimizable=true일 때만, 없으면 빈 문자열)"
  }
]

판단 기준:
- 사진 전체를 스캔해 문제 번호가 있는 영역을 모두 찾아 각각 분석
- 학생이 쓴 최종 답을 수학적으로 검증 → 틀렸으면 isWrong=true
- 풀이가 없거나 빈칸이면 isWrong=true
- 답은 맞아도 불필요하게 복잡한 방법이면 isOptimizable=true
- 글씨가 불명확하면 보이는 대로 최대한 판단
- 순수 JSON 배열만 출력. 다른 텍스트 절대 금지.`;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_API_KEY 없음" }, { status: 500 });

  let body: { imageBase64: string; mimeType: string };
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
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 2000, temperature: 0.1 },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: "학생 풀이를 분석해줘." }] }],
    });
    const raw = result.text ?? "";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      problemNum: string;
      isWrong: boolean;
      wrongReason: string;
      problemText: string;
      solution: string;
      concept: string;
      isOptimizable: boolean;
      optimizeTip: string;
    }[];
    // 배열이 아닌 경우(이전 형식 호환) 배열로 감싸기
    const results = Array.isArray(parsed) ? parsed : [parsed];
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: "AI 분석 실패", detail: String(err) }, { status: 500 });
  }
}
