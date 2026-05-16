# 수능 분석기

수능 모의고사 오답 노트 & 성적 추이 분석 웹 앱

## 기술 스택

- **프레임워크**: Next.js 16 (App Router) + TypeScript
- **스타일**: Tailwind CSS v4 + shadcn/ui
- **차트**: Recharts
- **DB**: SQLite + Prisma 7 (libsql 어댑터)

## 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. DB 마이그레이션 + 시드 (단원 마스터 & 샘플 데이터)
npm run db:migrate
npm run db:seed

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run db:migrate` | DB 스키마 마이그레이션 |
| `npm run db:seed` | 단원 마스터 & 샘플 데이터 삽입 |
| `npm run db:studio` | Prisma Studio (DB GUI) |
| `npm run db:reset` | DB 초기화 후 재마이그레이션 |

## 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 대시보드 (최근 시험, 오답 Top5, 유형 분포, 추이 차트) |
| `/exams/new` | 모의고사 입력 |
| `/wrong-notes` | 오답 노트 (필터·검색·즐겨찾기) |
| `/trends` | 과목별 점수 추이 차트 + 테이블 |
| `/weakness` | 취약점 분석 (단원별 정답률, 반복 취약 단원, 학습 우선순위) |

## 데이터 모델

```
Exam (모의고사 회차)
  └─ Subject (과목 + 선택과목)
       ├─ Score (성적: 원점수/표준점수/백분위/등급)
       └─ Question (문항별 오답 기록)

Unit (단원 마스터 — 국어/수학/영어/한국사/사탐 8과목/과탐 8과목)
```

## DB 변경 (SQLite → PostgreSQL)

`prisma.config.ts`의 `datasource.url`을 PostgreSQL URL로,
`prisma/schema.prisma`의 `provider`를 `"postgresql"`로 변경 후
`npm run db:migrate` 실행
