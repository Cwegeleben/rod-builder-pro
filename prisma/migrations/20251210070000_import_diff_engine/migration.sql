-- CreateTable
CREATE TABLE "ProductImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierSlug" TEXT NOT NULL,
    "supplierId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalAdds" INTEGER NOT NULL DEFAULT 0,
    "totalChanges" INTEGER NOT NULL DEFAULT 0,
    "totalDeletes" INTEGER NOT NULL DEFAULT 0,
    "summary" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductImportRunItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "supplierSlug" TEXT NOT NULL,
    "supplierSiteId" TEXT,
    "productCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "family" TEXT,
    "kind" TEXT NOT NULL,
    "beforeSnapshot" JSON,
    "afterSnapshot" JSON,
    "changedFields" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductImportRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductImportRunItem_runId_idx" ON "ProductImportRunItem"("runId");
