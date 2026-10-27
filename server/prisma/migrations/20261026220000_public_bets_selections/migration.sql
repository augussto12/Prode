ALTER TABLE "BetPost" ALTER COLUMN "groupId" DROP NOT NULL;
ALTER TABLE "BetPost" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'GROUP';
ALTER TABLE "BetPost" ADD COLUMN "totalOdds" DECIMAL(24,12);

CREATE TABLE "BetSelection" (
  "id" SERIAL NOT NULL,
  "postId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "event" TEXT NOT NULL,
  "team" TEXT,
  "player" TEXT,
  "pick" TEXT NOT NULL,
  "odds" DECIMAL(24,12),
  CONSTRAINT "BetSelection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BetPost_visibility_sequence_idx" ON "BetPost"("visibility", "sequence");
CREATE UNIQUE INDEX "BetPost_authorId_provider_originalUrl_key" ON "BetPost"("authorId", "provider", "originalUrl");
CREATE INDEX "BetSelection_postId_position_idx" ON "BetSelection"("postId", "position");
CREATE INDEX "BetSelection_team_idx" ON "BetSelection"("team");
CREATE INDEX "BetSelection_player_idx" ON "BetSelection"("player");
ALTER TABLE "BetSelection" ADD CONSTRAINT "BetSelection_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetPost" ADD CONSTRAINT "BetPost_visibility_group_check" CHECK (("visibility" = 'PUBLIC' AND "groupId" IS NULL) OR ("visibility" = 'GROUP' AND "groupId" IS NOT NULL));
