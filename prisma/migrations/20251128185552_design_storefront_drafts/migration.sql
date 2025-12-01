/*
  Warnings:

  - You are about to alter the column `compatibility` on the `DesignStudioAnnotationAudit` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.

*/
-- CreateTable
CREATE TABLE "DesignStorefrontDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STARTER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "selections" JSONB,
    "summary" JSONB,
    "customer" JSONB,
    "metadata" JSONB,
    "notes" TEXT,
    "expiresAt" DATETIME,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DesignBuild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STARTER',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fulfillmentMode" TEXT NOT NULL DEFAULT 'RBP_BUILD',
    "storefrontDraftId" TEXT,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DesignBuild_storefrontDraftId_fkey" FOREIGN KEY ("storefrontDraftId") REFERENCES "DesignStorefrontDraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DesignBuild" ("approvedAt", "assignedBuilder", "blankSku", "blankTitle", "blockedReason", "bomHash", "budgetCeiling", "componentSummary", "createdAt", "customerEmail", "customerName", "customerPhone", "experienceLevel", "fulfilledAt", "fulfillmentMode", "id", "metadata", "notesJson", "promisedShipWeek", "reference", "scheduledAt", "shopDomain", "status", "submittedAt", "tier", "updatedAt", "useCase") SELECT "approvedAt", "assignedBuilder", "blankSku", "blankTitle", "blockedReason", "bomHash", "budgetCeiling", "componentSummary", "createdAt", "customerEmail", "customerName", "customerPhone", "experienceLevel", "fulfilledAt", "fulfillmentMode", "id", "metadata", "notesJson", "promisedShipWeek", "reference", "scheduledAt", "shopDomain", "status", "submittedAt", "tier", "updatedAt", "useCase" FROM "DesignBuild";
DROP TABLE "DesignBuild";
ALTER TABLE "new_DesignBuild" RENAME TO "DesignBuild";
CREATE UNIQUE INDEX "DesignBuild_reference_key" ON "DesignBuild"("reference");
CREATE UNIQUE INDEX "DesignBuild_storefrontDraftId_key" ON "DesignBuild"("storefrontDraftId");
CREATE INDEX "DesignBuild_shopDomain_status_idx" ON "DesignBuild"("shopDomain", "status");
CREATE INDEX "DesignBuild_tier_idx" ON "DesignBuild"("tier");
CREATE INDEX "DesignBuild_storefrontDraftId_idx" ON "DesignBuild"("storefrontDraftId");
CREATE TABLE "new_DesignStudioAnnotationAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productVersionId" TEXT,
    "designStudioHash" TEXT NOT NULL,
    "ready" BOOLEAN NOT NULL,
    "family" TEXT,
    "series" TEXT,
    "role" TEXT,
    "coverageNotes" TEXT,
    "sourceQuality" TEXT,
    "compatibility" JSONB,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'importer',
    CONSTRAINT "DesignStudioAnnotationAudit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DesignStudioAnnotationAudit_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DesignStudioAnnotationAudit" ("compatibility", "coverageNotes", "designStudioHash", "family", "id", "productId", "productVersionId", "ready", "recordedAt", "role", "series", "source", "sourceQuality") SELECT "compatibility", "coverageNotes", "designStudioHash", "family", "id", "productId", "productVersionId", "ready", "recordedAt", "role", "series", "source", "sourceQuality" FROM "DesignStudioAnnotationAudit";
DROP TABLE "DesignStudioAnnotationAudit";
ALTER TABLE "new_DesignStudioAnnotationAudit" RENAME TO "DesignStudioAnnotationAudit";
CREATE INDEX "DesignStudioAnnotationAudit_productId_recordedAt_idx" ON "DesignStudioAnnotationAudit"("productId", "recordedAt");
CREATE INDEX "DesignStudioAnnotationAudit_designStudioHash_idx" ON "DesignStudioAnnotationAudit"("designStudioHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DesignStorefrontDraft_token_key" ON "DesignStorefrontDraft"("token");

-- CreateIndex
CREATE INDEX "DesignStorefrontDraft_shopDomain_status_idx" ON "DesignStorefrontDraft"("shopDomain", "status");
