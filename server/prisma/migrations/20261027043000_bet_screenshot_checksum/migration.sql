ALTER TABLE "BetScreenshot" ADD COLUMN "checksum" TEXT;
CREATE INDEX "BetScreenshot_checksum_idx" ON "BetScreenshot"("checksum");
