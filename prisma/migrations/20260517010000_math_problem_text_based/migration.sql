-- MathProblem 테이블 재구성: 이미지 제거, source 추가
ALTER TABLE "MathProblem" ADD COLUMN "source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MathProblem" DROP COLUMN IF EXISTS "imageData";
ALTER TABLE "MathProblem" DROP COLUMN IF EXISTS "mimeType";
