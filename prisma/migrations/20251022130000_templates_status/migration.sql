-- <!-- BEGIN RBP GENERATED: importer-templates-zero-orphan-v1 -->
PRAGMA foreign_keys=OFF;

-- Add status column with enum-like CHECK constraint and default
ALTER TABLE "SpecTemplate" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('PENDING','ACTIVE','ARCHIVED'));

PRAGMA foreign_keys=ON;
-- <!-- END RBP GENERATED: importer-templates-zero-orphan-v1 -->