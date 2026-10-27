CREATE TABLE "BetScreenshot" (
  "id" TEXT NOT NULL,
  "draftId" TEXT,
  "postId" TEXT,
  "position" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "image" BYTEA NOT NULL,
  "ocrText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BetScreenshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BetScreenshot_owner_check" CHECK (("draftId" IS NOT NULL AND "postId" IS NULL) OR ("draftId" IS NULL AND "postId" IS NOT NULL))
);
CREATE INDEX "BetScreenshot_draftId_position_idx" ON "BetScreenshot"("draftId", "position");
CREATE INDEX "BetScreenshot_postId_position_idx" ON "BetScreenshot"("postId", "position");
CREATE INDEX "BetImportDraft_expiresAt_idx" ON "BetImportDraft"("expiresAt");
ALTER TABLE "BetScreenshot" ADD CONSTRAINT "BetScreenshot_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "BetImportDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetScreenshot" ADD CONSTRAINT "BetScreenshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
