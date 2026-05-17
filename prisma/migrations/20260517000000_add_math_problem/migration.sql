CREATE TABLE "MathProblem" (
  "id"        TEXT NOT NULL,
  "title"     TEXT NOT NULL DEFAULT '',
  "imageData" TEXT NOT NULL,
  "mimeType"  TEXT NOT NULL DEFAULT 'image/jpeg',
  "unit"      TEXT NOT NULL DEFAULT '',
  "memo"      TEXT NOT NULL DEFAULT '',
  "aiNote"    TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MathProblem_pkey" PRIMARY KEY ("id")
);
