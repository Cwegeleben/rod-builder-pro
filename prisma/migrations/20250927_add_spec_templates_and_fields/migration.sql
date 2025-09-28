-- <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
-- CreateTable SpecTemplate
CREATE TABLE "SpecTemplate" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- Unique index on handle
CREATE UNIQUE INDEX "SpecTemplate_handle_key" ON "SpecTemplate" ("handle");

-- CreateTable SpecField
CREATE TABLE "SpecField" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "templateId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "required" INTEGER NOT NULL DEFAULT 0,
  "storageMode" TEXT NOT NULL DEFAULT 'METAFIELD',
  "position" INTEGER NOT NULL DEFAULT 0,
  "productField" TEXT,
  "namespace" TEXT,
  "metafieldKey" TEXT,
  "metafieldType" TEXT,
  CONSTRAINT "SpecField_template_fkey" FOREIGN KEY ("templateId") REFERENCES "SpecTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique index for key per template
CREATE UNIQUE INDEX "SpecField_templateId_key_key" ON "SpecField" ("templateId", "key");

-- Helper indexes
CREATE INDEX "SpecField_templateId_idx" ON "SpecField" ("templateId");
CREATE INDEX "SpecTemplate_updatedAt_idx" ON "SpecTemplate" ("updatedAt");
-- <!-- END RBP GENERATED: products-module-v3-0 -->
