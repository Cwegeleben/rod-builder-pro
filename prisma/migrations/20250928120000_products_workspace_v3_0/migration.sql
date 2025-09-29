-- SENTINEL: products-workspace-v3-0 (Prisma migration)
-- BEGIN products-workspace-v3-0
PRAGMA foreign_keys=OFF;

CREATE TABLE "_prisma_migration_lock" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "is_locked" BOOLEAN NOT NULL DEFAULT 1);

-- Enums in SQLite are text fields validated by Prisma Client

CREATE TABLE "SpecTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SpecField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    "storage" TEXT NOT NULL,
    "coreFieldPath" TEXT,
    "metafieldNamespace" TEXT,
    "metafieldKey" TEXT,
    "metafieldType" TEXT,
    CONSTRAINT "SpecField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SpecField_templateId_key_unique" ON "SpecField" ("templateId", "key");

-- Trigger to emulate updatedAt
CREATE TRIGGER IF NOT EXISTS trigger_SpecTemplate_updatedAt
AFTER UPDATE ON "SpecTemplate"
FOR EACH ROW
BEGIN
  UPDATE "SpecTemplate" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

PRAGMA foreign_keys=ON;
-- END products-workspace-v3-0