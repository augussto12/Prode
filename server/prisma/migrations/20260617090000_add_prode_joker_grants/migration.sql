ALTER TABLE "Prediction"
ADD COLUMN "jokerPhaseKey" TEXT,
ADD COLUMN "jokerGrantId" INTEGER;

CREATE TABLE "ProdeJokerConfig" (
  "id" SERIAL NOT NULL,
  "competitionId" INTEGER NOT NULL,
  "phaseMode" TEXT NOT NULL DEFAULT 'AUTO_WITH_MANUAL_FALLBACK',
  "manualPhaseKey" TEXT,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProdeJokerConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProdeJokerGrant" (
  "id" SERIAL NOT NULL,
  "competitionId" INTEGER NOT NULL,
  "phaseKey" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "message" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "releasedById" INTEGER,
  "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProdeJokerGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProdeJokerGrantSeen" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "grantId" INTEGER NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProdeJokerGrantSeen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProdeJokerConfig_competitionId_key"
ON "ProdeJokerConfig"("competitionId");

CREATE INDEX "ProdeJokerConfig_manualPhaseKey_idx"
ON "ProdeJokerConfig"("manualPhaseKey");

CREATE INDEX "ProdeJokerGrant_competitionId_phaseKey_isActive_idx"
ON "ProdeJokerGrant"("competitionId", "phaseKey", "isActive");

CREATE INDEX "ProdeJokerGrant_releasedAt_idx"
ON "ProdeJokerGrant"("releasedAt");

CREATE UNIQUE INDEX "ProdeJokerGrantSeen_userId_grantId_key"
ON "ProdeJokerGrantSeen"("userId", "grantId");

CREATE INDEX "ProdeJokerGrantSeen_grantId_idx"
ON "ProdeJokerGrantSeen"("grantId");

CREATE INDEX "Prediction_jokerPhaseKey_idx"
ON "Prediction"("jokerPhaseKey");

CREATE INDEX "Prediction_jokerGrantId_idx"
ON "Prediction"("jokerGrantId");
