-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "supplierSiteId" TEXT,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "category" TEXT,
    "family" TEXT,
    "brand" TEXT,
    "series" TEXT,
    "material" TEXT,
    "color" TEXT,
    "designPartType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "latestVersionId" TEXT,
    "publishHandle" TEXT,
    "description" TEXT,
    "images" JSONB,
    "priceMsrp" DECIMAL,
    "priceWholesale" DECIMAL,
    "availability" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "attributes" JSONB,
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
INSERT INTO "new_Product" ("availability", "createdAt", "description", "designPartType", "designStudioBlockingReasons", "designStudioCompatibility", "designStudioCoverageNotes", "designStudioFamily", "designStudioHash", "designStudioLastTouchedAt", "designStudioReady", "designStudioRole", "designStudioSeries", "designStudioSourceQuality", "id", "images", "latestVersionId", "priceMsrp", "priceWholesale", "publishHandle", "sku", "status", "supplierId", "title", "type", "updatedAt") SELECT "availability", "createdAt", "description", "designPartType", "designStudioBlockingReasons", "designStudioCompatibility", "designStudioCoverageNotes", "designStudioFamily", "designStudioHash", "designStudioLastTouchedAt", "designStudioReady", "designStudioRole", "designStudioSeries", "designStudioSourceQuality", "id", "images", "latestVersionId", "priceMsrp", "priceWholesale", "publishHandle", "sku", "status", "supplierId", "title", "type", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_latestVersionId_key" ON "Product"("latestVersionId");
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");
CREATE INDEX "product_category_family_idx" ON "Product"("category", "family");
CREATE INDEX "product_design_ready_idx" ON "Product"("designStudioReady");
CREATE UNIQUE INDEX "Product_supplierId_sku_key" ON "Product"("supplierId", "sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
