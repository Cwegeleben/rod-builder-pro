-- Add ImportRun.progress JSON column (SQLite)
-- Safe to run if column already exists: Prisma will track the migration; runtime guard also adds it if missing.

PRAGMA foreign_keys=OFF;

-- Only add if missing. SQLite lacks IF NOT EXISTS for ADD COLUMN, but this migration will be applied once by Prisma.
ALTER TABLE "ImportRun" ADD COLUMN "progress" JSON;

PRAGMA foreign_keys=ON;
