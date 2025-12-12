-- <!-- BEGIN RBP GENERATED: design-studio-phase-c-v1 -->
-- AlterTable (DesignBuild)
ALTER TABLE "DesignBuild" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "DesignBuild" ADD COLUMN "customerId" TEXT;
ALTER TABLE "DesignBuild" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "DesignBuild" ADD COLUMN "roleSelections" JSONB;
ALTER TABLE "DesignBuild" ADD COLUMN "compatContext" JSONB;
ALTER TABLE "DesignBuild" ADD COLUMN "validationSnapshot" JSONB;
ALTER TABLE "DesignBuild" ADD COLUMN "latestDraftId" TEXT;
ALTER TABLE "DesignBuild" ADD COLUMN "telemetryVersion" TEXT;
ALTER TABLE "DesignBuild" ADD COLUMN "notes" TEXT;
ALTER TABLE "DesignBuild" ADD COLUMN "legacyBuildId" TEXT;

-- AlterTable (DesignBuildEvent)
ALTER TABLE "DesignBuildEvent" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "DesignBuildEvent" ADD COLUMN "occurredAt" DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DesignBuildEvent" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE "DesignBuildEvent" ADD COLUMN "details" JSONB;
ALTER TABLE "DesignBuildEvent" ADD COLUMN "visibility" TEXT;

-- CreateTable (DesignBuildDraft)
CREATE TABLE "DesignBuildDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "draftPayload" JSONB NOT NULL,
    "compatContext" JSONB,
    "validationSnapshot" JSONB,
    "status" TEXT NOT NULL,
    "lastTouchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedFromExternalId" TEXT,
    "expiresAt" DATETIME,
    CONSTRAINT "DesignBuildDraft_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "DesignBuild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DesignBuildDraft_buildId_idx" ON "DesignBuildDraft"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignBuildDraft_buildId_version_key" ON "DesignBuildDraft"("buildId", "version");
-- <!-- END RBP GENERATED: design-studio-phase-c-v1 -->
