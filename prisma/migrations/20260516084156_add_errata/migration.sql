-- CreateTable
CREATE TABLE "Errata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "subjectName" TEXT,
    "questionNumber" INTEGER,
    "errataType" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "description" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Errata_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Errata_examId_idx" ON "Errata"("examId");
