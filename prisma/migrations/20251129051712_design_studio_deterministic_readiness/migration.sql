-- AlterTable
ALTER TABLE "PartStaging" ADD COLUMN "availability" TEXT;
ALTER TABLE "PartStaging" ADD COLUMN "designPartType" TEXT;
ALTER TABLE "PartStaging" ADD COLUMN "designStudioBlockingReasons" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "designPartType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "latestVersionId" TEXT,
    "publishHandle" TEXT,
    "description" TEXT,
    "images" JSONB,
    "priceMsrp" DECIMAL,
    "priceWholesale" DECIMAL,
    "availability" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "designStudioReady" BOOLEAN NOT NULL DEFAULT false,
    "designStudioFamily" TEXT,
    "designStudioSeries" TEXT,
    "designStudioRole" TEXT,
    "designStudioCompatibility" JSONB,
    "designStudioSourceQuality" TEXT,
    "designStudioLastTouchedAt" DATETIME,
    "designStudioCoverageNotes" TEXT,
    "designStudioHash" TEXT NOT NULL DEFAULT '',
    "designStudioBlockingReasons" JSONB,
    CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Product_latestVersionId_fkey" FOREIGN KEY ("latestVersionId") REFERENCES "ProductVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("createdAt", "designStudioCoverageNotes", "designStudioFamily", "designStudioLastTouchedAt", "designStudioReady", "id", "latestVersionId", "publishHandle", "sku", "status", "supplierId", "title", "type", "updatedAt") SELECT "createdAt", "designStudioCoverageNotes", "designStudioFamily", "designStudioLastTouchedAt", "designStudioReady", "id", "latestVersionId", "publishHandle", "sku", "status", "supplierId", "title", "type", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_latestVersionId_key" ON "Product"("latestVersionId");
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");
CREATE UNIQUE INDEX "Product_supplierId_sku_key" ON "Product"("supplierId", "sku");
CREATE TABLE "new_ProductVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "designPartType" TEXT,
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
    "designStudioReady" BOOLEAN NOT NULL DEFAULT false,
    "designStudioFamily" TEXT,
    "designStudioRole" TEXT,
    "designStudioSeries" TEXT,
    "designStudioCompatibility" JSONB,
    "designStudioSourceQuality" TEXT,
    "designStudioCoverageNotes" TEXT,
    "designStudioHash" TEXT NOT NULL DEFAULT '',
    "designStudioBlockingReasons" JSONB,
    CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductVersion" ("availability", "contentHash", "createdAt", "description", "designStudioCompatibility", "designStudioHash", "designStudioRole", "designStudioSeries", "designStudioSourceQuality", "fetchedAt", "id", "images", "normSpecs", "priceMsrp", "priceWholesale", "productId", "rawSpecs", "sourceSnapshot") SELECT "availability", "contentHash", "createdAt", "description", "designStudioCompatibility", "designStudioHash", "designStudioRole", "designStudioSeries", "designStudioSourceQuality", "fetchedAt", "id", "images", "normSpecs", "priceMsrp", "priceWholesale", "productId", "rawSpecs", "sourceSnapshot" FROM "ProductVersion";
DROP TABLE "ProductVersion";
ALTER TABLE "new_ProductVersion" RENAME TO "ProductVersion";
CREATE INDEX "ProductVersion_productId_idx" ON "ProductVersion"("productId");
CREATE UNIQUE INDEX "ProductVersion_productId_contentHash_key" ON "ProductVersion"("productId", "contentHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
