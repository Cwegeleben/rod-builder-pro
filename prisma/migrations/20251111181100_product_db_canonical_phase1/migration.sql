-- Canonical product_db phase 1 tables (Supplier, Product, ProductVersion, ProductSource, PublishTelemetry, ImportTelemetry)
-- Safe to apply after prior JSON->TEXT normalization.
PRAGMA foreign_keys=OFF;

-- Supplier
CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "urlRoot" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Product
CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "latestVersionId" TEXT,
  "publishHandle" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_supplier_sku_unique" ON "Product"("supplierId","sku");
CREATE INDEX IF NOT EXISTS "Product_supplierId_idx" ON "Product"("supplierId");

-- ProductVersion
CREATE TABLE IF NOT EXISTS "ProductVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "rawSpecs" TEXT,
  "normSpecs" TEXT,
  "description" TEXT,
  "images" TEXT,
  "priceMsrp" DECIMAL,
  "priceWholesale" DECIMAL,
  "availability" TEXT,
  "sourceSnapshot" TEXT,
  "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_version_hash_unique" ON "ProductVersion"("productId","contentHash");
CREATE INDEX IF NOT EXISTS "ProductVersion_productId_idx" ON "ProductVersion"("productId");

-- ProductSource (canonical link)
CREATE TABLE IF NOT EXISTS "ProductSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "templateId" TEXT,
  "url" TEXT NOT NULL,
  "externalId" TEXT,
  "source" TEXT NOT NULL,
  "notes" TEXT,
  "productId" TEXT,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductSource_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductSource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_source_supplier_template_url_unique" ON "ProductSource"("supplierId","templateId","url");

-- PublishTelemetry
CREATE TABLE IF NOT EXISTS "PublishTelemetry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productIds" TEXT,
  "attempted" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "durationMs" INTEGER,
  "diag" TEXT
);
CREATE INDEX IF NOT EXISTS "PublishTelemetry_startedAt_idx" ON "PublishTelemetry"("startedAt");

-- ImportTelemetry
CREATE TABLE IF NOT EXISTS "ImportTelemetry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL UNIQUE,
  "supplierId" TEXT NOT NULL,
  "newProducts" INTEGER NOT NULL DEFAULT 0,
  "newVersions" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "diag" TEXT
);
CREATE INDEX IF NOT EXISTS "ImportTelemetry_supplierId_idx" ON "ImportTelemetry"("supplierId");
CREATE INDEX IF NOT EXISTS "ImportTelemetry_startedAt_idx" ON "ImportTelemetry"("startedAt");

PRAGMA foreign_keys=ON;