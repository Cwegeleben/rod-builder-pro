/* Adjusted migration: removed unsafe internal lock table drop and index renames that caused SQLite errors. */
-- CreateTable
CREATE TABLE "ImportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierDomain" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "paginationJson" JSONB,
    "followDetail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportJob" (
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

-- CreateTable
CREATE TABLE "ImportItem" (
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

-- CreateTable
CREATE TABLE "SupplierAuthProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierDomain" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "cookieJarJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupplierInventorySnapshot" (
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
-- CreateIndex
CREATE UNIQUE INDEX "ImportProfile_supplierDomain_productType_key" ON "ImportProfile"("supplierDomain", "productType");
-- CreateIndex
CREATE UNIQUE INDEX "SupplierAuthProfile_supplierDomain_username_key" ON "SupplierAuthProfile"("supplierDomain", "username");
-- NOTE: Existing SpecField and SpecTemplate indexes retained; no changes applied here to avoid SQLite constraint drop errors.
