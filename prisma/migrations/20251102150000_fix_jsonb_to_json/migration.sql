-- Fix JSONB columns created incorrectly in SQLite by recreating affected tables with JSON columns
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ImportRun: summary JSONB -> JSON
CREATE TABLE "new_ImportRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "status" TEXT NOT NULL,
  "summary" JSON
);
INSERT INTO "new_ImportRun" ("id","supplierId","startedAt","finishedAt","status","summary")
SELECT "id","supplierId","startedAt","finishedAt","status","summary" FROM "ImportRun";
DROP TABLE "ImportRun";
ALTER TABLE "new_ImportRun" RENAME TO "ImportRun";

-- ImportDiff: before/after/validation JSONB -> JSON
CREATE TABLE "new_ImportDiff" (
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
INSERT INTO "new_ImportDiff" ("id","importRunId","externalId","diffType","before","after","validation","resolution","resolvedBy","resolvedAt")
SELECT "id","importRunId","externalId","diffType","before","after","validation","resolution","resolvedBy","resolvedAt" FROM "ImportDiff";
DROP TABLE "ImportDiff";
ALTER TABLE "new_ImportDiff" RENAME TO "ImportDiff";

-- PartStaging: images/rawSpecs/normSpecs/publishResult/shopifyVariantIds JSONB -> JSON
CREATE TABLE "new_PartStaging" (
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
  "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shopifyProductId" TEXT,
  "shopifyVariantIds" JSON,
  "publishedAt" DATETIME,
  "publishStatus" TEXT,
  "publishResult" JSON
);
INSERT INTO "new_PartStaging" (
  "id","supplierId","externalId","title","partType","description","images","rawSpecs","normSpecs",
  "priceMsrp","priceWh","hashContent","fetchedAt","shopifyProductId","shopifyVariantIds","publishedAt","publishStatus","publishResult"
) SELECT 
  "id","supplierId","externalId","title","partType","description","images","rawSpecs","normSpecs",
  "priceMsrp","priceWh","hashContent","fetchedAt","shopifyProductId","shopifyVariantIds","publishedAt","publishStatus","publishResult"
FROM "PartStaging";
DROP TABLE "PartStaging";
ALTER TABLE "new_PartStaging" RENAME TO "PartStaging";
CREATE UNIQUE INDEX "PartStaging_supplierId_externalId_key" ON "PartStaging"("supplierId", "externalId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;