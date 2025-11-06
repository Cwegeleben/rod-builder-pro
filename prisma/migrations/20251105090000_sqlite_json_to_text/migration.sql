-- Normalize JSON/JSONB columns to TEXT for SQLite compatibility
-- This migration recreates affected tables with TEXT columns for JSON fields.
-- It is safe to apply after earlier migrations that introduced JSON/JSONB types.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ImportTemplate: importConfig JSON/JSONB -> TEXT, preserve indices and preparingRunId
CREATE TABLE "new_ImportTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "importConfig" TEXT NOT NULL DEFAULT '{}',
  "state" TEXT NOT NULL DEFAULT 'NEEDS_SETTINGS',
  "lastRunAt" DATETIME,
  "hadFailures" BOOLEAN NOT NULL DEFAULT false,
  "preparingRunId" TEXT
);
INSERT INTO "new_ImportTemplate" ("id","name","importConfig","state","lastRunAt","hadFailures","preparingRunId")
SELECT "id","name","importConfig","state","lastRunAt","hadFailures",COALESCE("preparingRunId", NULL) FROM "ImportTemplate";
DROP TABLE "ImportTemplate";
ALTER TABLE "new_ImportTemplate" RENAME TO "ImportTemplate";
CREATE INDEX IF NOT EXISTS "ImportTemplate_state_idx" ON "ImportTemplate"("state");
CREATE INDEX IF NOT EXISTS "ImportTemplate_preparingRunId_idx" ON "ImportTemplate"("preparingRunId");

-- ImportLog: payload JSON/JSONB -> TEXT
CREATE TABLE "new_ImportLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ImportTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImportLog" ("id","templateId","runId","type","payload","at")
SELECT "id","templateId","runId","type","payload","at" FROM "ImportLog";
DROP TABLE "ImportLog";
ALTER TABLE "new_ImportLog" RENAME TO "ImportLog";
CREATE INDEX IF NOT EXISTS "ImportLog_tpl_run_type_idx" ON "ImportLog"("templateId","runId","type");

-- ImportRun: summary/progress JSON -> TEXT
CREATE TABLE "new_ImportRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "status" TEXT NOT NULL,
  "progress" TEXT,
  "summary" TEXT
);
INSERT INTO "new_ImportRun" ("id","supplierId","startedAt","finishedAt","status","progress","summary")
SELECT "id","supplierId","startedAt","finishedAt","status",COALESCE("progress", NULL),"summary" FROM "ImportRun";
DROP TABLE "ImportRun";
ALTER TABLE "new_ImportRun" RENAME TO "ImportRun";

-- ImportDiff: before/after/validation JSON -> TEXT
CREATE TABLE "new_ImportDiff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "importRunId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "diffType" TEXT NOT NULL,
  "before" TEXT,
  "after" TEXT,
  "validation" TEXT,
  "resolution" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" DATETIME
);
INSERT INTO "new_ImportDiff" ("id","importRunId","externalId","diffType","before","after","validation","resolution","resolvedBy","resolvedAt")
SELECT "id","importRunId","externalId","diffType","before","after","validation","resolution","resolvedBy","resolvedAt" FROM "ImportDiff";
DROP TABLE "ImportDiff";
ALTER TABLE "new_ImportDiff" RENAME TO "ImportDiff";

-- PartStaging: images/rawSpecs/normSpecs/shopifyVariantIds/publishResult JSON -> TEXT, preserve unique index
CREATE TABLE "new_PartStaging" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "partType" TEXT NOT NULL,
  "description" TEXT,
  "images" TEXT,
  "rawSpecs" TEXT,
  "normSpecs" TEXT,
  "priceMsrp" DECIMAL,
  "priceWh" DECIMAL,
  "hashContent" TEXT NOT NULL DEFAULT '',
  "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shopifyProductId" TEXT,
  "shopifyVariantIds" TEXT,
  "publishedAt" DATETIME,
  "publishStatus" TEXT,
  "publishResult" TEXT
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
CREATE UNIQUE INDEX IF NOT EXISTS "PartStaging_supplierId_externalId_key" ON "PartStaging"("supplierId", "externalId");

-- ImportProfile: mappingJson/paginationJson JSONB -> TEXT, preserve unique index
CREATE TABLE "new_ImportProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierDomain" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "mappingJson" TEXT NOT NULL,
  "paginationJson" TEXT,
  "followDetail" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ImportProfile" ("id","supplierDomain","productType","mappingJson","paginationJson","followDetail","createdAt","updatedAt")
SELECT "id","supplierDomain","productType","mappingJson","paginationJson","followDetail","createdAt","updatedAt" FROM "ImportProfile";
DROP TABLE "ImportProfile";
ALTER TABLE "new_ImportProfile" RENAME TO "ImportProfile";
CREATE UNIQUE INDEX IF NOT EXISTS "ImportProfile_supplierDomain_productType_key" ON "ImportProfile"("supplierDomain","productType");

-- ImportJob: countsJson/logJson JSONB -> TEXT
CREATE TABLE "new_ImportJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profileId" TEXT,
  "url" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "countsJson" TEXT NOT NULL,
  "logJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ImportJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ImportProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ImportJob" ("id","profileId","url","productType","status","countsJson","logJson","createdAt","updatedAt")
SELECT "id","profileId","url","productType","status","countsJson","logJson","createdAt","updatedAt" FROM "ImportJob";
DROP TABLE "ImportJob";
ALTER TABLE "new_ImportJob" RENAME TO "ImportJob";

-- ImportItem: rawJson/mappedJson JSONB -> TEXT, preserve FK
CREATE TABLE "new_ImportItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "rawJson" TEXT NOT NULL,
  "mappedJson" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImportItem" ("id","jobId","sourceUrl","rawJson","mappedJson","status","error","createdAt")
SELECT "id","jobId","sourceUrl","rawJson","mappedJson","status","error","createdAt" FROM "ImportItem";
DROP TABLE "ImportItem";
ALTER TABLE "new_ImportItem" RENAME TO "ImportItem";

-- SupplierAuthProfile: cookieJarJson JSONB -> TEXT, preserve unique index
CREATE TABLE "new_SupplierAuthProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierDomain" TEXT NOT NULL,
  "loginUrl" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordEnc" TEXT NOT NULL,
  "cookieJarJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SupplierAuthProfile" ("id","supplierDomain","loginUrl","username","passwordEnc","cookieJarJson","createdAt","updatedAt")
SELECT "id","supplierDomain","loginUrl","username","passwordEnc","cookieJarJson","createdAt","updatedAt" FROM "SupplierAuthProfile";
DROP TABLE "SupplierAuthProfile";
ALTER TABLE "new_SupplierAuthProfile" RENAME TO "SupplierAuthProfile";
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierAuthProfile_supplierDomain_username_key" ON "SupplierAuthProfile"("supplierDomain","username");

-- SupplierInventorySnapshot: snapshotJson JSONB -> TEXT
CREATE TABLE "new_SupplierInventorySnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierDomain" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "qtyAvailable" INTEGER,
  "cost" REAL,
  "lastSeenAt" DATETIME,
  "snapshotJson" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SupplierInventorySnapshot" ("id","supplierDomain","productCode","qtyAvailable","cost","lastSeenAt","snapshotJson","status","createdAt")
SELECT "id","supplierDomain","productCode","qtyAvailable","cost","lastSeenAt","snapshotJson","status","createdAt" FROM "SupplierInventorySnapshot";
DROP TABLE "SupplierInventorySnapshot";
ALTER TABLE "new_SupplierInventorySnapshot" RENAME TO "SupplierInventorySnapshot";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
