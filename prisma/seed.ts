import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "node:path";

const rawUrl = process.env["DATABASE_URL"] ?? `file:./prisma/dev.db`;
// libsql requires absolute file paths for local SQLite
const dbUrl = rawUrl.startsWith("file:./") || rawUrl.startsWith("file:../")
  ? `file:${path.resolve(rawUrl.replace(/^file:/, ""))}`
  : rawUrl;
const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const units = [
  // ── 국어 공통 ──
  { subjectName: "국어", optionName: null, name: "독서-인문", order: 1 },
  { subjectName: "국어", optionName: null, name: "독서-사회", order: 2 },
  { subjectName: "국어", optionName: null, name: "독서-과학기술", order: 3 },
  { subjectName: "국어", optionName: null, name: "독서-예술", order: 4 },
  { subjectName: "국어", optionName: null, name: "독서-복합", order: 5 },
  { subjectName: "국어", optionName: null, name: "문학-현대시", order: 6 },
  { subjectName: "국어", optionName: null, name: "문학-현대소설", order: 7 },
  { subjectName: "국어", optionName: null, name: "문학-고전시가", order: 8 },
  { subjectName: "국어", optionName: null, name: "문학-고전소설", order: 9 },
  { subjectName: "국어", optionName: null, name: "문학-복합갈래", order: 10 },

  // 국어 선택 - 언어와 매체
  { subjectName: "국어", optionName: "언어와매체", name: "언어-음운", order: 11 },
  { subjectName: "국어", optionName: "언어와매체", name: "언어-형태론", order: 12 },
  { subjectName: "국어", optionName: "언어와매체", name: "언어-통사론", order: 13 },
  { subjectName: "국어", optionName: "언어와매체", name: "매체-정보 전달 매체", order: 14 },
  { subjectName: "국어", optionName: "언어와매체", name: "매체-복합 매체", order: 15 },

  // 국어 선택 - 화법과 작문
  { subjectName: "국어", optionName: "화법과작문", name: "화법-대화/토론", order: 11 },
  { subjectName: "국어", optionName: "화법과작문", name: "화법-발표/연설", order: 12 },
  { subjectName: "국어", optionName: "화법과작문", name: "작문-설명문/논설문", order: 13 },
  { subjectName: "국어", optionName: "화법과작문", name: "작문-실용문", order: 14 },
  { subjectName: "국어", optionName: "화법과작문", name: "화작-복합", order: 15 },

  // ── 수학 공통 ──
  { subjectName: "수학", optionName: null, name: "지수와 로그", order: 1 },
  { subjectName: "수학", optionName: null, name: "삼각함수", order: 2 },
  { subjectName: "수학", optionName: null, name: "수열", order: 3 },

  // 수학 선택 - 미적분
  { subjectName: "수학", optionName: "미적분", name: "수열의 극한", order: 4 },
  { subjectName: "수학", optionName: "미적분", name: "미분법", order: 5 },
  { subjectName: "수학", optionName: "미적분", name: "적분법", order: 6 },

  // 수학 선택 - 확률과통계
  { subjectName: "수학", optionName: "확률과통계", name: "경우의 수", order: 4 },
  { subjectName: "수학", optionName: "확률과통계", name: "확률", order: 5 },
  { subjectName: "수학", optionName: "확률과통계", name: "통계", order: 6 },

  // 수학 선택 - 기하
  { subjectName: "수학", optionName: "기하", name: "이차곡선", order: 4 },
  { subjectName: "수학", optionName: "기하", name: "평면벡터", order: 5 },
  { subjectName: "수학", optionName: "기하", name: "공간도형과 공간좌표", order: 6 },

  // ── 영어 ──
  { subjectName: "영어", optionName: null, name: "듣기", order: 1 },
  { subjectName: "영어", optionName: null, name: "읽기-어휘/어법", order: 2 },
  { subjectName: "영어", optionName: null, name: "읽기-빈칸추론", order: 3 },
  { subjectName: "영어", optionName: null, name: "읽기-주제/제목/요지", order: 4 },
  { subjectName: "영어", optionName: null, name: "읽기-글의순서/문장삽입", order: 5 },
  { subjectName: "영어", optionName: null, name: "읽기-장문독해", order: 6 },

  // ── 한국사 ──
  { subjectName: "한국사", optionName: null, name: "전근대-선사~고려", order: 1 },
  { subjectName: "한국사", optionName: null, name: "전근대-조선", order: 2 },
  { subjectName: "한국사", optionName: null, name: "근대-개항기", order: 3 },
  { subjectName: "한국사", optionName: null, name: "근대-일제강점기", order: 4 },
  { subjectName: "한국사", optionName: null, name: "현대-광복이후", order: 5 },

  // ── 사탐 ──
  // 생활과 윤리
  { subjectName: "사탐", optionName: "생활과윤리", name: "현대 생활과 윤리", order: 1 },
  { subjectName: "사탐", optionName: "생활과윤리", name: "생명·성·가족 윤리", order: 2 },
  { subjectName: "사탐", optionName: "생활과윤리", name: "사회·직업 윤리", order: 3 },
  { subjectName: "사탐", optionName: "생활과윤리", name: "환경·과학·정보 윤리", order: 4 },
  { subjectName: "사탐", optionName: "생활과윤리", name: "문화·평화·지구 윤리", order: 5 },

  // 윤리와 사상
  { subjectName: "사탐", optionName: "윤리와사상", name: "동양 윤리", order: 1 },
  { subjectName: "사탐", optionName: "윤리와사상", name: "서양 윤리", order: 2 },
  { subjectName: "사탐", optionName: "윤리와사상", name: "사회사상", order: 3 },

  // 한국지리
  { subjectName: "사탐", optionName: "한국지리", name: "국토 인식과 지리 정보", order: 1 },
  { subjectName: "사탐", optionName: "한국지리", name: "기후 환경", order: 2 },
  { subjectName: "사탐", optionName: "한국지리", name: "지형 환경", order: 3 },
  { subjectName: "사탐", optionName: "한국지리", name: "거주 공간의 변화", order: 4 },
  { subjectName: "사탐", optionName: "한국지리", name: "생산과 소비 공간", order: 5 },

  // 세계지리
  { subjectName: "사탐", optionName: "세계지리", name: "세계화와 지역 이해", order: 1 },
  { subjectName: "사탐", optionName: "세계지리", name: "자연환경", order: 2 },
  { subjectName: "사탐", optionName: "세계지리", name: "인문환경과 문화", order: 3 },
  { subjectName: "사탐", optionName: "세계지리", name: "몬순 아시아와 오세아니아", order: 4 },
  { subjectName: "사탐", optionName: "세계지리", name: "건조 아시아와 북아프리카", order: 5 },
  { subjectName: "사탐", optionName: "세계지리", name: "유럽과 북부 아메리카", order: 6 },

  // 동아시아사
  { subjectName: "사탐", optionName: "동아시아사", name: "동아시아의 성립", order: 1 },
  { subjectName: "사탐", optionName: "동아시아사", name: "동아시아 세계의 발전", order: 2 },
  { subjectName: "사탐", optionName: "동아시아사", name: "동아시아의 사회 변동", order: 3 },
  { subjectName: "사탐", optionName: "동아시아사", name: "근대화 운동과 국민국가", order: 4 },
  { subjectName: "사탐", optionName: "동아시아사", name: "오늘날의 동아시아", order: 5 },

  // 세계사
  { subjectName: "사탐", optionName: "세계사", name: "문명의 발생과 고대 세계", order: 1 },
  { subjectName: "사탐", optionName: "세계사", name: "유럽·아메리카 세계의 변화", order: 2 },
  { subjectName: "사탐", optionName: "세계사", name: "서아시아·인도의 역사", order: 3 },
  { subjectName: "사탐", optionName: "세계사", name: "동아시아의 역사", order: 4 },
  { subjectName: "사탐", optionName: "세계사", name: "제국주의와 두 차례 세계대전", order: 5 },
  { subjectName: "사탐", optionName: "세계사", name: "냉전과 탈냉전", order: 6 },

  // 경제
  { subjectName: "사탐", optionName: "경제", name: "경제생활과 경제문제", order: 1 },
  { subjectName: "사탐", optionName: "경제", name: "시장과 경제활동", order: 2 },
  { subjectName: "사탐", optionName: "경제", name: "국가와 경제활동", order: 3 },
  { subjectName: "사탐", optionName: "경제", name: "세계 시장과 한국 경제", order: 4 },

  // 정치와 법
  { subjectName: "사탐", optionName: "정치와법", name: "민주주의와 헌법", order: 1 },
  { subjectName: "사탐", optionName: "정치와법", name: "민주국가의 정치 과정", order: 2 },
  { subjectName: "사탐", optionName: "정치와법", name: "개인생활과 법", order: 3 },
  { subjectName: "사탐", optionName: "정치와법", name: "사회생활과 법", order: 4 },
  { subjectName: "사탐", optionName: "정치와법", name: "국제관계와 한반도", order: 5 },

  // 사회·문화
  { subjectName: "사탐", optionName: "사회문화", name: "사회·문화 현상의 탐구", order: 1 },
  { subjectName: "사탐", optionName: "사회문화", name: "개인과 사회 구조", order: 2 },
  { subjectName: "사탐", optionName: "사회문화", name: "문화와 일상생활", order: 3 },
  { subjectName: "사탐", optionName: "사회문화", name: "사회 계층과 불평등", order: 4 },
  { subjectName: "사탐", optionName: "사회문화", name: "현대의 사회 변동", order: 5 },

  // ── 과탐 ──
  // 물리학I
  { subjectName: "과탐", optionName: "물리학I", name: "역학과 에너지", order: 1 },
  { subjectName: "과탐", optionName: "물리학I", name: "전기와 자기", order: 2 },
  { subjectName: "과탐", optionName: "물리학I", name: "파동과 정보통신", order: 3 },

  // 물리학II
  { subjectName: "과탐", optionName: "물리학II", name: "역학적 상호 작용", order: 1 },
  { subjectName: "과탐", optionName: "물리학II", name: "전자기장", order: 2 },
  { subjectName: "과탐", optionName: "물리학II", name: "파동과 빛", order: 3 },
  { subjectName: "과탐", optionName: "물리학II", name: "열역학", order: 4 },

  // 화학I
  { subjectName: "과탐", optionName: "화학I", name: "화학의 첫걸음", order: 1 },
  { subjectName: "과탐", optionName: "화학I", name: "원자의 세계", order: 2 },
  { subjectName: "과탐", optionName: "화학I", name: "화학 결합과 분자 세계", order: 3 },
  { subjectName: "과탐", optionName: "화학I", name: "역동적인 화학 반응", order: 4 },

  // 화학II
  { subjectName: "과탐", optionName: "화학II", name: "물질의 세 가지 상태와 용액", order: 1 },
  { subjectName: "과탐", optionName: "화학II", name: "반응 속도와 화학 평형", order: 2 },
  { subjectName: "과탐", optionName: "화학II", name: "전기 화학", order: 3 },

  // 생명과학I
  { subjectName: "과탐", optionName: "생명과학I", name: "생명 과학의 이해", order: 1 },
  { subjectName: "과탐", optionName: "생명과학I", name: "세포와 생명의 연속성", order: 2 },
  { subjectName: "과탐", optionName: "생명과학I", name: "항상성과 몸의 조절", order: 3 },
  { subjectName: "과탐", optionName: "생명과학I", name: "유전", order: 4 },
  { subjectName: "과탐", optionName: "생명과학I", name: "생태계와 상호 작용", order: 5 },

  // 생명과학II
  { subjectName: "과탐", optionName: "생명과학II", name: "세포의 특성", order: 1 },
  { subjectName: "과탐", optionName: "생명과학II", name: "세포 호흡과 광합성", order: 2 },
  { subjectName: "과탐", optionName: "생명과학II", name: "유전자 발현과 조절", order: 3 },
  { subjectName: "과탐", optionName: "생명과학II", name: "생물의 진화", order: 4 },

  // 지구과학I
  { subjectName: "과탐", optionName: "지구과학I", name: "고체 지구", order: 1 },
  { subjectName: "과탐", optionName: "지구과학I", name: "유체 지구", order: 2 },
  { subjectName: "과탐", optionName: "지구과학I", name: "우주", order: 3 },

  // 지구과학II
  { subjectName: "과탐", optionName: "지구과학II", name: "지구의 형성과 역장", order: 1 },
  { subjectName: "과탐", optionName: "지구과학II", name: "지구의 역사", order: 2 },
  { subjectName: "과탐", optionName: "지구과학II", name: "대기와 해양의 변화", order: 3 },
  { subjectName: "과탐", optionName: "지구과학II", name: "천체 관측", order: 4 },
];

async function main() {
  console.log("🌱 Seeding unit master data...");

  for (const unit of units) {
    await prisma.unit.upsert({
      where: {
        subjectName_optionName_name: {
          subjectName: unit.subjectName,
          optionName: unit.optionName ?? "",
          name: unit.name,
        },
      },
      update: {},
      create: {
        subjectName: unit.subjectName,
        optionName: unit.optionName,
        name: unit.name,
        order: unit.order,
      },
    });
  }

  console.log(`✅ Seeded ${units.length} units`);

  // 샘플 데이터 (개발용)
  const sampleExam = await prisma.exam.create({
    data: {
      name: "2025학년도 6월 모의평가",
      date: new Date("2024-06-04"),
      type: "평가원",
      grade: "고3",
    },
  });

  const korSubject = await prisma.subject.create({
    data: {
      examId: sampleExam.id,
      name: "국어",
      optionName: "언어와매체",
      rawScore: 87,
      standardScore: 128,
      percentile: 93,
      grade: 2,
      maxRawScore: 100,
    },
  });

  const mathSubject = await prisma.subject.create({
    data: {
      examId: sampleExam.id,
      name: "수학",
      optionName: "미적분",
      rawScore: 72,
      standardScore: 130,
      percentile: 90,
      grade: 2,
      maxRawScore: 100,
    },
  });

  // 샘플 오답
  await prisma.question.createMany({
    data: [
      {
        subjectId: korSubject.id,
        number: 15,
        unit: "독서-과학기술",
        topic: "과학 지문 독해",
        difficulty: "상",
        isCorrect: false,
        wrongType: "문제이해실패",
        memo: "지문이 너무 길어서 핵심 파악 실패",
      },
      {
        subjectId: korSubject.id,
        number: 38,
        unit: "문학-고전시가",
        topic: "시조 작품 분석",
        difficulty: "중",
        isCorrect: false,
        wrongType: "개념부족",
        memo: "고전시가 표현법 복습 필요",
      },
      {
        subjectId: mathSubject.id,
        number: 21,
        unit: "적분법",
        topic: "정적분의 활용",
        difficulty: "상",
        isCorrect: false,
        wrongType: "시간부족",
        memo: "풀이 방향은 맞았는데 시간 초과",
      },
      {
        subjectId: mathSubject.id,
        number: 28,
        unit: "수열",
        topic: "점화식",
        difficulty: "상",
        isCorrect: false,
        wrongType: "개념부족",
        memo: "점화식 일반항 도출 공식 재정리 필요",
      },
      {
        subjectId: mathSubject.id,
        number: 30,
        unit: "미분법",
        topic: "함수의 극값",
        difficulty: "상",
        isCorrect: false,
        wrongType: "실수",
        memo: "부호 실수로 틀림, 검산 습관 필요",
      },
    ],
  });

  console.log("✅ Sample exam and questions created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
