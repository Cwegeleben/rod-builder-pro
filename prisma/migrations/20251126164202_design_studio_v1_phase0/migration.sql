/*
  Warnings:

  - You are about to alter the column `countsJson` on the `ImportDeleteAudit` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `deletedJson` on the `ImportDeleteAudit` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `after` on the `ImportDiff` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `before` on the `ImportDiff` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `validation` on the `ImportDiff` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `mappedJson` on the `ImportItem` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `rawJson` on the `ImportItem` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `countsJson` on the `ImportJob` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `logJson` on the `ImportJob` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `payload` on the `ImportLog` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `mappingJson` on the `ImportProfile` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `paginationJson` on the `ImportProfile` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `progress` on the `ImportRun` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `summary` on the `ImportRun` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `diag` on the `ImportTelemetry` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `importConfig` on the `ImportTemplate` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `images` on the `PartStaging` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `normSpecs` on the `PartStaging` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `publishResult` on the `PartStaging` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `rawSpecs` on the `PartStaging` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `shopifyVariantIds` on the `PartStaging` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `images` on the `ProductVersion` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `normSpecs` on the `ProductVersion` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `rawSpecs` on the `ProductVersion` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `sourceSnapshot` on the `ProductVersion` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `diag` on the `PublishTelemetry` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `productIds` on the `PublishTelemetry` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `cookieJarJson` on the `SupplierAuthProfile` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `snapshotJson` on the `SupplierInventorySnapshot` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `currentSyncRun` on the `SupplierSyncState` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `lastSyncRun` on the `SupplierSyncState` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `lastSyncSummary` on the `SupplierSyncState` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- CreateTable
CREATE TABLE "TemplateAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "labelNorm" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RunMappingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scraperId" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RunItemMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "applied" JSONB NOT NULL,
    "diagnostics" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SupplierCredentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "usernameEnc" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "totpEnc" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cron" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "lastRunAt" DATETIME,
    "nextDueAt" DATETIME
);

-- CreateTable
CREATE TABLE "SupplierCookieJar" (
    "supplierId" TEXT NOT NULL PRIMARY KEY,
    "jarEncrypted" TEXT NOT NULL,
    "lastLoginAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DesignBuild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STARTER',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fulfillmentMode" TEXT NOT NULL DEFAULT 'RBP_BUILD',
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "useCase" TEXT,
    "experienceLevel" TEXT,
    "blankSku" TEXT,
    "blankTitle" TEXT,
    "componentSummary" JSONB,
    "bomHash" TEXT,
    "promisedShipWeek" DATETIME,
    "assignedBuilder" TEXT,
    "budgetCeiling" DECIMAL,
    "notesJson" JSONB,
    "metadata" JSONB,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "scheduledAt" DATETIME,
    "fulfilledAt" DATETIME,
    "blockedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DesignBuildEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignBuildEvent_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "DesignBuild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DesignBuildAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildId" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignBuildAttachment_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "DesignBuild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "designStudioEnabled" BOOLEAN NOT NULL DEFAULT false,
    "designStudioTier" TEXT NOT NULL DEFAULT 'STARTER',
    "designStudioConfig" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportDeleteAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateIds" TEXT NOT NULL,
    "countsJson" JSONB,
    "deletedJson" JSONB,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "userHq" BOOLEAN NOT NULL DEFAULT true,
    "blockedCodes" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ImportDeleteAudit" ("blockedCodes", "countsJson", "createdAt", "deletedJson", "dryRun", "durationMs", "forced", "id", "templateIds", "userHq") SELECT "blockedCodes", "countsJson", "createdAt", "deletedJson", "dryRun", "durationMs", "forced", "id", "templateIds", "userHq" FROM "ImportDeleteAudit";
DROP TABLE "ImportDeleteAudit";
ALTER TABLE "new_ImportDeleteAudit" RENAME TO "ImportDeleteAudit";
CREATE TABLE "new_ImportDiff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importRunId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "diffType" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "validation" JSONB,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME
);
INSERT INTO "new_ImportDiff" ("after", "before", "diffType", "externalId", "id", "importRunId", "resolution", "resolvedAt", "resolvedBy", "validation") SELECT "after", "before", "diffType", "externalId", "id", "importRunId", "resolution", "resolvedAt", "resolvedBy", "validation" FROM "ImportDiff";
DROP TABLE "ImportDiff";
ALTER TABLE "new_ImportDiff" RENAME TO "ImportDiff";
CREATE TABLE "new_ImportItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "mappedJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImportItem" ("createdAt", "error", "id", "jobId", "mappedJson", "rawJson", "sourceUrl", "status") SELECT "createdAt", "error", "id", "jobId", "mappedJson", "rawJson", "sourceUrl", "status" FROM "ImportItem";
DROP TABLE "ImportItem";
ALTER TABLE "new_ImportItem" RENAME TO "ImportItem";
CREATE TABLE "new_ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT,
    "url" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "countsJson" JSONB NOT NULL,
    "logJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ImportProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ImportJob" ("countsJson", "createdAt", "id", "logJson", "productType", "profileId", "status", "updatedAt", "url") SELECT "countsJson", "createdAt", "id", "logJson", "productType", "profileId", "status", "updatedAt", "url" FROM "ImportJob";
DROP TABLE "ImportJob";
ALTER TABLE "new_ImportJob" RENAME TO "ImportJob";
CREATE TABLE "new_ImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ImportTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImportLog" ("at", "id", "payload", "runId", "templateId", "type") SELECT "at", "id", "payload", "runId", "templateId", "type" FROM "ImportLog";
DROP TABLE "ImportLog";
ALTER TABLE "new_ImportLog" RENAME TO "ImportLog";
CREATE INDEX "ImportLog_templateId_runId_type_idx" ON "ImportLog"("templateId", "runId", "type");
CREATE TABLE "new_ImportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierDomain" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "paginationJson" JSONB,
    "followDetail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ImportProfile" ("createdAt", "followDetail", "id", "mappingJson", "paginationJson", "productType", "supplierDomain", "updatedAt") SELECT "createdAt", "followDetail", "id", "mappingJson", "paginationJson", "productType", "supplierDomain", "updatedAt" FROM "ImportProfile";
DROP TABLE "ImportProfile";
ALTER TABLE "new_ImportProfile" RENAME TO "ImportProfile";
CREATE UNIQUE INDEX "ImportProfile_supplierDomain_productType_key" ON "ImportProfile"("supplierDomain", "productType");
CREATE TABLE "new_ImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "progress" JSONB,
    "summary" JSONB
);
INSERT INTO "new_ImportRun" ("finishedAt", "id", "progress", "startedAt", "status", "summary", "supplierId") SELECT "finishedAt", "id", "progress", "startedAt", "status", "summary", "supplierId" FROM "ImportRun";
DROP TABLE "ImportRun";
ALTER TABLE "new_ImportRun" RENAME TO "ImportRun";
CREATE TABLE "new_ImportTelemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "newProducts" INTEGER NOT NULL DEFAULT 0,
    "newVersions" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "diag" JSONB
);
INSERT INTO "new_ImportTelemetry" ("diag", "durationMs", "failed", "finishedAt", "id", "newProducts", "newVersions", "runId", "skipped", "startedAt", "supplierId") SELECT "diag", "durationMs", "failed", "finishedAt", "id", "newProducts", "newVersions", "runId", "skipped", "startedAt", "supplierId" FROM "ImportTelemetry";
DROP TABLE "ImportTelemetry";
ALTER TABLE "new_ImportTelemetry" RENAME TO "ImportTelemetry";
CREATE UNIQUE INDEX "ImportTelemetry_runId_key" ON "ImportTelemetry"("runId");
CREATE INDEX "ImportTelemetry_supplierId_idx" ON "ImportTelemetry"("supplierId");
CREATE INDEX "ImportTelemetry_startedAt_idx" ON "ImportTelemetry"("startedAt");
CREATE TABLE "new_ImportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "importConfig" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NEEDS_SETTINGS',
    "lastRunAt" DATETIME,
    "hadFailures" BOOLEAN NOT NULL DEFAULT false,
    "preparingRunId" TEXT
);
INSERT INTO "new_ImportTemplate" ("hadFailures", "id", "importConfig", "lastRunAt", "name", "preparingRunId", "state") SELECT "hadFailures", "id", "importConfig", "lastRunAt", "name", "preparingRunId", "state" FROM "ImportTemplate";
DROP TABLE "ImportTemplate";
ALTER TABLE "new_ImportTemplate" RENAME TO "ImportTemplate";
CREATE INDEX "ImportTemplate_state_idx" ON "ImportTemplate"("state");
CREATE INDEX "ImportTemplate_preparingRunId_idx" ON "ImportTemplate"("preparingRunId");
CREATE TABLE "new_PartStaging" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "templateId" TEXT,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "partType" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB,
    "rawSpecs" JSONB,
    "normSpecs" JSONB,
    "priceMsrp" DECIMAL,
    "priceWh" DECIMAL,
    "hashContent" TEXT NOT NULL DEFAULT '',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "designStudioReady" BOOLEAN NOT NULL DEFAULT false,
    "designStudioFamily" TEXT,
    "designStudioSeries" TEXT,
    "designStudioRole" TEXT,
    "designStudioCompatibility" JSONB,
    "designStudioCoverageNotes" TEXT,
    "designStudioSourceQuality" TEXT,
    "designStudioHash" TEXT NOT NULL DEFAULT '',
    "shopifyProductId" TEXT,
    "shopifyVariantIds" JSONB,
    "publishedAt" DATETIME,
    "publishStatus" TEXT,
    "publishResult" JSONB
);
INSERT INTO "new_PartStaging" ("description", "externalId", "fetchedAt", "hashContent", "id", "images", "normSpecs", "partType", "priceMsrp", "priceWh", "publishResult", "publishStatus", "publishedAt", "rawSpecs", "shopifyProductId", "shopifyVariantIds", "supplierId", "title") SELECT "description", "externalId", "fetchedAt", "hashContent", "id", "images", "normSpecs", "partType", "priceMsrp", "priceWh", "publishResult", "publishStatus", "publishedAt", "rawSpecs", "shopifyProductId", "shopifyVariantIds", "supplierId", "title" FROM "PartStaging";
DROP TABLE "PartStaging";
ALTER TABLE "new_PartStaging" RENAME TO "PartStaging";
CREATE UNIQUE INDEX "PartStaging_supplierId_templateId_externalId_key" ON "PartStaging"("supplierId", "templateId", "externalId");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "latestVersionId" TEXT,
    "publishHandle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "designStudioReady" BOOLEAN NOT NULL DEFAULT false,
    "designStudioFamily" TEXT,
    "designStudioLastTouchedAt" DATETIME,
    "designStudioCoverageNotes" TEXT,
    CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Product_latestVersionId_fkey" FOREIGN KEY ("latestVersionId") REFERENCES "ProductVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("createdAt", "id", "latestVersionId", "publishHandle", "sku", "status", "supplierId", "title", "type", "updatedAt") SELECT "createdAt", "id", "latestVersionId", "publishHandle", "sku", "status", "supplierId", "title", "type", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_latestVersionId_key" ON "Product"("latestVersionId");
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");
CREATE UNIQUE INDEX "Product_supplierId_sku_key" ON "Product"("supplierId", "sku");
CREATE TABLE "new_ProductSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "templateId" TEXT,
    "url" TEXT NOT NULL,
    "externalId" TEXT,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "htmlHash" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT,
    CONSTRAINT "ProductSource_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductSource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductSource" ("externalId", "firstSeenAt", "htmlHash", "id", "lastSeenAt", "notes", "productId", "source", "supplierId", "templateId", "url") SELECT "externalId", "firstSeenAt", "htmlHash", "id", "lastSeenAt", "notes", "productId", "source", "supplierId", "templateId", "url" FROM "ProductSource";
DROP TABLE "ProductSource";
ALTER TABLE "new_ProductSource" RENAME TO "ProductSource";
CREATE UNIQUE INDEX "ProductSource_supplierId_templateId_url_key" ON "ProductSource"("supplierId", "templateId", "url");
CREATE TABLE "new_ProductVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rawSpecs" JSONB,
    "normSpecs" JSONB,
    "description" TEXT,
    "images" JSONB,
    "priceMsrp" DECIMAL,
    "priceWholesale" DECIMAL,
    "availability" TEXT,
    "sourceSnapshot" JSONB,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "designStudioRole" TEXT,
    "designStudioSeries" TEXT,
    "designStudioCompatibility" JSONB,
    "designStudioSourceQuality" TEXT,
    "designStudioHash" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductVersion" ("availability", "contentHash", "createdAt", "description", "fetchedAt", "id", "images", "normSpecs", "priceMsrp", "priceWholesale", "productId", "rawSpecs", "sourceSnapshot") SELECT "availability", "contentHash", "createdAt", "description", "fetchedAt", "id", "images", "normSpecs", "priceMsrp", "priceWholesale", "productId", "rawSpecs", "sourceSnapshot" FROM "ProductVersion";
DROP TABLE "ProductVersion";
ALTER TABLE "new_ProductVersion" RENAME TO "ProductVersion";
CREATE INDEX "ProductVersion_productId_idx" ON "ProductVersion"("productId");
CREATE UNIQUE INDEX "ProductVersion_productId_contentHash_key" ON "ProductVersion"("productId", "contentHash");
CREATE TABLE "new_PublishTelemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productIds" JSONB,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "diag" JSONB
);
INSERT INTO "new_PublishTelemetry" ("attempted", "created", "diag", "durationMs", "failed", "finishedAt", "id", "productIds", "skipped", "startedAt", "updated") SELECT "attempted", "created", "diag", "durationMs", "failed", "finishedAt", "id", "productIds", "skipped", "startedAt", "updated" FROM "PublishTelemetry";
DROP TABLE "PublishTelemetry";
ALTER TABLE "new_PublishTelemetry" RENAME TO "PublishTelemetry";
CREATE INDEX "PublishTelemetry_startedAt_idx" ON "PublishTelemetry"("startedAt");
CREATE TABLE "new_SpecTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cost" REAL,
    "productImageUrl" TEXT,
    "supplierAvailability" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "remoteTemplateId" TEXT,
    "remoteVersion" INTEGER
);
INSERT INTO "new_SpecTemplate" ("cost", "createdAt", "id", "name", "remoteTemplateId", "remoteVersion", "status", "updatedAt") SELECT "cost", "createdAt", "id", "name", "remoteTemplateId", "remoteVersion", "status", "updatedAt" FROM "SpecTemplate";
DROP TABLE "SpecTemplate";
ALTER TABLE "new_SpecTemplate" RENAME TO "SpecTemplate";
CREATE UNIQUE INDEX "SpecTemplate_name_key" ON "SpecTemplate"("name");
CREATE INDEX "SpecTemplate_remoteTemplateId_idx" ON "SpecTemplate"("remoteTemplateId");
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "urlRoot" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Supplier" ("active", "createdAt", "id", "name", "slug", "updatedAt", "urlRoot") SELECT "active", "createdAt", "id", "name", "slug", "updatedAt", "urlRoot" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");
CREATE TABLE "new_SupplierAuthProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierDomain" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "cookieJarJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SupplierAuthProfile" ("cookieJarJson", "createdAt", "id", "loginUrl", "passwordEnc", "supplierDomain", "updatedAt", "username") SELECT "cookieJarJson", "createdAt", "id", "loginUrl", "passwordEnc", "supplierDomain", "updatedAt", "username" FROM "SupplierAuthProfile";
DROP TABLE "SupplierAuthProfile";
ALTER TABLE "new_SupplierAuthProfile" RENAME TO "SupplierAuthProfile";
CREATE UNIQUE INDEX "SupplierAuthProfile_supplierDomain_username_key" ON "SupplierAuthProfile"("supplierDomain", "username");
CREATE TABLE "new_SupplierInventorySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierDomain" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "qtyAvailable" INTEGER,
    "cost" REAL,
    "lastSeenAt" DATETIME,
    "snapshotJson" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SupplierInventorySnapshot" ("cost", "createdAt", "id", "lastSeenAt", "productCode", "qtyAvailable", "snapshotJson", "status", "supplierDomain") SELECT "cost", "createdAt", "id", "lastSeenAt", "productCode", "qtyAvailable", "snapshotJson", "status", "supplierDomain" FROM "SupplierInventorySnapshot";
DROP TABLE "SupplierInventorySnapshot";
ALTER TABLE "new_SupplierInventorySnapshot" RENAME TO "SupplierInventorySnapshot";
CREATE TABLE "new_SupplierSyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierSlug" TEXT NOT NULL,
    "authCookieEnc" TEXT,
    "authCookieSetAt" DATETIME,
    "authCookieSetBy" TEXT,
    "authCookieValidatedAt" DATETIME,
    "authStatus" TEXT,
    "authMessage" TEXT,
    "lastSyncJobId" TEXT,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncSummary" JSONB,
    "lastSyncError" TEXT,
    "currentSyncRun" JSONB,
    "lastSyncRun" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SupplierSyncState" ("authCookieEnc", "authCookieSetAt", "authCookieSetBy", "authCookieValidatedAt", "authMessage", "authStatus", "createdAt", "currentSyncRun", "id", "lastSyncAt", "lastSyncError", "lastSyncJobId", "lastSyncRun", "lastSyncStatus", "lastSyncSummary", "supplierSlug", "updatedAt") SELECT "authCookieEnc", "authCookieSetAt", "authCookieSetBy", "authCookieValidatedAt", "authMessage", "authStatus", "createdAt", "currentSyncRun", "id", "lastSyncAt", "lastSyncError", "lastSyncJobId", "lastSyncRun", "lastSyncStatus", "lastSyncSummary", "supplierSlug", "updatedAt" FROM "SupplierSyncState";
DROP TABLE "SupplierSyncState";
ALTER TABLE "new_SupplierSyncState" RENAME TO "SupplierSyncState";
CREATE UNIQUE INDEX "SupplierSyncState_supplierSlug_key" ON "SupplierSyncState"("supplierSlug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TemplateAlias_templateId_labelNorm_key" ON "TemplateAlias"("templateId", "labelNorm");

-- CreateIndex
CREATE UNIQUE INDEX "RunMappingSnapshot_runId_key" ON "RunMappingSnapshot"("runId");

-- CreateIndex
CREATE INDEX "RunItemMapping_runId_idx" ON "RunItemMapping"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunItemMapping_runId_itemKey_key" ON "RunItemMapping"("runId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredentials_supplierId_key" ON "SupplierCredentials"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignBuild_reference_key" ON "DesignBuild"("reference");

-- CreateIndex
CREATE INDEX "DesignBuild_shopDomain_status_idx" ON "DesignBuild"("shopDomain", "status");

-- CreateIndex
CREATE INDEX "DesignBuild_tier_idx" ON "DesignBuild"("tier");

-- CreateIndex
CREATE INDEX "DesignBuildEvent_buildId_createdAt_idx" ON "DesignBuildEvent"("buildId", "createdAt");

-- CreateIndex
CREATE INDEX "DesignBuildAttachment_buildId_idx" ON "DesignBuildAttachment"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_shopDomain_key" ON "TenantSettings"("shopDomain");
