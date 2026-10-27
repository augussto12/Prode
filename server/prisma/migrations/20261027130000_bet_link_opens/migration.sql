CREATE TABLE "BetLinkOpen" (
  "postId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BetLinkOpen_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE INDEX "BetLinkOpen_userId_idx" ON "BetLinkOpen"("userId");
ALTER TABLE "BetLinkOpen" ADD CONSTRAINT "BetLinkOpen_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetLinkOpen" ADD CONSTRAINT "BetLinkOpen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
