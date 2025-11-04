-- Add preparingRunId column and index to ImportTemplate (SQLite)
PRAGMA foreign_keys=OFF;

-- Add column
ALTER TABLE "ImportTemplate" ADD COLUMN "preparingRunId" TEXT;

-- Create index for preparingRunId lookups
CREATE INDEX IF NOT EXISTS "ImportTemplate_preparingRunId_idx" ON "ImportTemplate"("preparingRunId");

PRAGMA foreign_keys=ON;
