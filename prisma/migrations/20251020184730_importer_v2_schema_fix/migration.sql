/*
  Warnings:

  - You are about to drop the `_prisma_migration_lock` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "_prisma_migration_lock";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ImporterVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "version" TEXT NOT NULL DEFAULT '2.0-scrape',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "summary" JSON
);

-- CreateTable
CREATE TABLE "ImportDiff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importRunId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "diffType" TEXT NOT NULL,
    "before" JSON,
    "after" JSON,
    "validation" JSON,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PartStaging" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "partType" TEXT NOT NULL,
    "description" TEXT,
    "images" JSON,
    "rawSpecs" JSON,
    "normSpecs" JSON,
    "priceMsrp" DECIMAL,
    "priceWh" DECIMAL,
    "hashContent" TEXT NOT NULL DEFAULT '',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductTypeTemplateMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProductTypeTemplateMap" ("createdAt", "id", "productType", "templateId", "updatedAt") SELECT "createdAt", "id", "productType", "templateId", "updatedAt" FROM "ProductTypeTemplateMap";
DROP TABLE "ProductTypeTemplateMap";
ALTER TABLE "new_ProductTypeTemplateMap" RENAME TO "ProductTypeTemplateMap";
CREATE UNIQUE INDEX "ProductTypeTemplateMap_productType_key" ON "ProductTypeTemplateMap"("productType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PartStaging_supplierId_externalId_key" ON "PartStaging"("supplierId", "externalId");

-- RedefineIndex
DROP INDEX IF EXISTS "SpecField_templateId_key_unique";
CREATE UNIQUE INDEX "SpecField_templateId_key_key" ON "SpecField"("templateId", "key");

-- RedefineIndex (skip dropping SQLite autoindex, just ensure named index exists)
CREATE UNIQUE INDEX IF NOT EXISTS "SpecTemplate_name_key" ON "SpecTemplate"("name");
