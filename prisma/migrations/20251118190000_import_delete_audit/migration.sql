-- Migration: import_delete_audit
-- Adds ImportDeleteAudit table for delete operation telemetry.
-- Safe: additive only.

CREATE TABLE "ImportDeleteAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateIds" TEXT NOT NULL,
  "countsJson" JSON,
  "deletedJson" JSON,
  "forced" BOOLEAN NOT NULL DEFAULT false,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "userHq" BOOLEAN NOT NULL DEFAULT true,
  "blockedCodes" TEXT,
  "durationMs" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying recent forced deletes
CREATE INDEX "ImportDeleteAudit_forced_createdAt_idx" ON "ImportDeleteAudit"("forced", "createdAt");
