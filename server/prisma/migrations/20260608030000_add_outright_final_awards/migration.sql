-- Final tournament awards: champion, runner-up, top scorer and golden glove.

ALTER TABLE "ScoringConfig"
  ADD COLUMN IF NOT EXISTS "champion" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "runnerUp" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "topScorer" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "goldenGlove" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "OutrightPrediction"
  ADD COLUMN IF NOT EXISTS "championTeamId" INTEGER,
  ADD COLUMN IF NOT EXISTS "runnerUpTeamId" INTEGER,
  ADD COLUMN IF NOT EXISTS "topScorerTeamId" INTEGER,
  ADD COLUMN IF NOT EXISTS "goldenGloveTeamId" INTEGER,
  ADD COLUMN IF NOT EXISTS "goldenGloveId" INTEGER,
  ADD COLUMN IF NOT EXISTS "championHit" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "runnerUpHit" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "topScorerHit" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "goldenGloveHit" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isCalculated" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "OutrightResult" (
  "id" SERIAL PRIMARY KEY,
  "competitionId" INTEGER NOT NULL,
  "lockAt" TIMESTAMP(3),
  "championTeamId" INTEGER,
  "runnerUpTeamId" INTEGER,
  "topScorerId" INTEGER,
  "goldenGloveId" INTEGER,
  "calculatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "OutrightResult_competitionId_key"
  ON "OutrightResult"("competitionId");
CREATE INDEX IF NOT EXISTS "OutrightResult_competitionId_idx"
  ON "OutrightResult"("competitionId");

CREATE INDEX IF NOT EXISTS "OutrightPrediction_competitionId_idx"
  ON "OutrightPrediction"("competitionId");
CREATE INDEX IF NOT EXISTS "OutrightPrediction_championTeamId_idx"
  ON "OutrightPrediction"("championTeamId");
CREATE INDEX IF NOT EXISTS "OutrightPrediction_runnerUpTeamId_idx"
  ON "OutrightPrediction"("runnerUpTeamId");
CREATE INDEX IF NOT EXISTS "OutrightPrediction_topScorerId_idx"
  ON "OutrightPrediction"("topScorerId");
CREATE INDEX IF NOT EXISTS "OutrightPrediction_goldenGloveId_idx"
  ON "OutrightPrediction"("goldenGloveId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightPrediction_championTeamId_fkey') THEN
    ALTER TABLE "OutrightPrediction" ADD CONSTRAINT "OutrightPrediction_championTeamId_fkey"
      FOREIGN KEY ("championTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightPrediction_runnerUpTeamId_fkey') THEN
    ALTER TABLE "OutrightPrediction" ADD CONSTRAINT "OutrightPrediction_runnerUpTeamId_fkey"
      FOREIGN KEY ("runnerUpTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightPrediction_topScorerTeamId_fkey') THEN
    ALTER TABLE "OutrightPrediction" ADD CONSTRAINT "OutrightPrediction_topScorerTeamId_fkey"
      FOREIGN KEY ("topScorerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightPrediction_goldenGloveTeamId_fkey') THEN
    ALTER TABLE "OutrightPrediction" ADD CONSTRAINT "OutrightPrediction_goldenGloveTeamId_fkey"
      FOREIGN KEY ("goldenGloveTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightPrediction_goldenGloveId_fkey') THEN
    ALTER TABLE "OutrightPrediction" ADD CONSTRAINT "OutrightPrediction_goldenGloveId_fkey"
      FOREIGN KEY ("goldenGloveId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightResult_competitionId_fkey') THEN
    ALTER TABLE "OutrightResult" ADD CONSTRAINT "OutrightResult_competitionId_fkey"
      FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightResult_championTeamId_fkey') THEN
    ALTER TABLE "OutrightResult" ADD CONSTRAINT "OutrightResult_championTeamId_fkey"
      FOREIGN KEY ("championTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightResult_runnerUpTeamId_fkey') THEN
    ALTER TABLE "OutrightResult" ADD CONSTRAINT "OutrightResult_runnerUpTeamId_fkey"
      FOREIGN KEY ("runnerUpTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightResult_topScorerId_fkey') THEN
    ALTER TABLE "OutrightResult" ADD CONSTRAINT "OutrightResult_topScorerId_fkey"
      FOREIGN KEY ("topScorerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutrightResult_goldenGloveId_fkey') THEN
    ALTER TABLE "OutrightResult" ADD CONSTRAINT "OutrightResult_goldenGloveId_fkey"
      FOREIGN KEY ("goldenGloveId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
