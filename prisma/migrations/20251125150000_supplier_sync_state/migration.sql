-- CreateTable
CREATE TABLE "SupplierSyncState" (
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
    "lastSyncSummary" TEXT,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSyncState_supplierSlug_key" ON "SupplierSyncState"("supplierSlug");
