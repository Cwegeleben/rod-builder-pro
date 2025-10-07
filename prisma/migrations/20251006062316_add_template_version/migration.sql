-- Simplified migration: create TemplateVersion if not exists and ensure unique index
PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS "TemplateVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "dataJson" TEXT NOT NULL,
  "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TemplateVersion_templateId_versionNumber_key" ON "TemplateVersion"("templateId", "versionNumber");
PRAGMA foreign_keys=ON;
