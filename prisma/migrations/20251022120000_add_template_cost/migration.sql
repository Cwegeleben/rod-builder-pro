-- <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
-- Add cost column to SpecTemplate (nullable with default 0)
PRAGMA foreign_keys=OFF;

ALTER TABLE "SpecTemplate" ADD COLUMN "cost" REAL DEFAULT 0;

PRAGMA foreign_keys=ON;
-- <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
