CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "tasks" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudyLog" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "date" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskCompletion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudyPlan_startDate_idx" ON "StudyPlan"("startDate");
CREATE INDEX "StudyLog_planId_idx" ON "StudyLog"("planId");
CREATE INDEX "StudyLog_date_idx" ON "StudyLog"("date");
CREATE UNIQUE INDEX "TaskCompletion_planId_date_subject_key" ON "TaskCompletion"("planId", "date", "subject");
CREATE INDEX "TaskCompletion_planId_idx" ON "TaskCompletion"("planId");
CREATE INDEX "TaskCompletion_date_idx" ON "TaskCompletion"("date");

ALTER TABLE "StudyLog" ADD CONSTRAINT "StudyLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
