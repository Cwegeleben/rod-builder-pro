-- CreateTable
CREATE TABLE "DesignStudioAnnotationAudit" (
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
    "compatibility" JSON,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'importer',
    CONSTRAINT "DesignStudioAnnotationAudit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DesignStudioAnnotationAudit_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DesignStudioAnnotationAudit_productId_recordedAt_idx" ON "DesignStudioAnnotationAudit"("productId", "recordedAt");

-- CreateIndex
CREATE INDEX "DesignStudioAnnotationAudit_designStudioHash_idx" ON "DesignStudioAnnotationAudit"("designStudioHash");
