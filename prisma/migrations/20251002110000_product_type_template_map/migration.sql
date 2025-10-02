-- CreateTable
CREATE TABLE "ProductTypeTemplateMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex (unique)
CREATE UNIQUE INDEX "ProductTypeTemplateMap_productType_key" ON "ProductTypeTemplateMap"("productType");
