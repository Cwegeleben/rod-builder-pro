-- Add status column to SpecTemplate (SQLite)
PRAGMA foreign_keys=OFF;
ALTER TABLE "SpecTemplate" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
PRAGMA foreign_keys=ON;
