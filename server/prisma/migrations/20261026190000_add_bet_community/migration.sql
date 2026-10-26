-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_competitionId_fkey";

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "competitionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BetTicket" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "originalOdds" DECIMAL(24,12) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetImportDraft" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "failureCode" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "BetImportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetPost" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "ticketId" TEXT,
    "originalUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "importState" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetComment" (
    "id" SERIAL NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetReaction" (
    "postId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetReaction_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "SavedBetPost" (
    "postId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedBetPost_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "BetReport" (
    "id" SERIAL NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetTicket_provider_host_externalId_key" ON "BetTicket"("provider", "host", "externalId");

-- CreateIndex
CREATE INDEX "BetImportDraft_userId_expiresAt_idx" ON "BetImportDraft"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BetPost_sequence_key" ON "BetPost"("sequence");

-- CreateIndex
CREATE INDEX "BetPost_groupId_sequence_idx" ON "BetPost"("groupId", "sequence");

-- CreateIndex
CREATE INDEX "BetPost_authorId_sequence_idx" ON "BetPost"("authorId", "sequence");

-- CreateIndex
CREATE INDEX "BetComment_postId_id_idx" ON "BetComment"("postId", "id");

-- CreateIndex
CREATE INDEX "SavedBetPost_userId_idx" ON "SavedBetPost"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BetReport_postId_userId_key" ON "BetReport"("postId", "userId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetImportDraft" ADD CONSTRAINT "BetImportDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPost" ADD CONSTRAINT "BetPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPost" ADD CONSTRAINT "BetPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPost" ADD CONSTRAINT "BetPost_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BetTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetComment" ADD CONSTRAINT "BetComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetComment" ADD CONSTRAINT "BetComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetReaction" ADD CONSTRAINT "BetReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetReaction" ADD CONSTRAINT "BetReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedBetPost" ADD CONSTRAINT "SavedBetPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedBetPost" ADD CONSTRAINT "SavedBetPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetReport" ADD CONSTRAINT "BetReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetReport" ADD CONSTRAINT "BetReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
