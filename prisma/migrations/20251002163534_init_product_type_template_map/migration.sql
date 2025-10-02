/*
  Warnings:

  - You are about to drop the `_prisma_migration_lock` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_prisma_migration_lock";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductTypeTemplateMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProductTypeTemplateMap" ("createdAt", "id", "productType", "templateId", "updatedAt") SELECT "createdAt", "id", "productType", "templateId", "updatedAt" FROM "ProductTypeTemplateMap";
DROP TABLE "ProductTypeTemplateMap";
ALTER TABLE "new_ProductTypeTemplateMap" RENAME TO "ProductTypeTemplateMap";
CREATE UNIQUE INDEX "ProductTypeTemplateMap_productType_key" ON "ProductTypeTemplateMap"("productType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
DROP INDEX "SpecField_templateId_key_unique";
CREATE UNIQUE INDEX "SpecField_templateId_key_key" ON "SpecField"("templateId", "key");

-- RedefineIndex
DROP INDEX "sqlite_autoindex_SpecTemplate_2";
CREATE UNIQUE INDEX "SpecTemplate_name_key" ON "SpecTemplate"("name");
