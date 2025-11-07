-- Create Importer v2.3 tables: ImportTemplate, ImportLog
-- SQLite-compatible: use TEXT columns for JSON payloads and configs

-- CreateTable ImportTemplate
CREATE TABLE IF NOT EXISTS "ImportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "importConfig" TEXT NOT NULL DEFAULT '{}',
    "state" TEXT NOT NULL DEFAULT 'NEEDS_SETTINGS',
    "lastRunAt" DATETIME,
    "hadFailures" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable ImportLog
CREATE TABLE IF NOT EXISTS "ImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ImportTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ImportTemplate_state_idx" ON "ImportTemplate"("state");
CREATE INDEX IF NOT EXISTS "ImportLog_tpl_run_type_idx" ON "ImportLog"("templateId", "runId", "type");
