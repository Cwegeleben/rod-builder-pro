-- Add Phase 2 remote draft linkage columns to SpecTemplate
ALTER TABLE "SpecTemplate" ADD COLUMN "remoteTemplateId" TEXT;
ALTER TABLE "SpecTemplate" ADD COLUMN "remoteVersion" INTEGER;
CREATE INDEX "SpecTemplate_remoteTemplateId_idx" ON "SpecTemplate"("remoteTemplateId");
