CREATE TABLE "BetAnonymousLinkOpen" (
  "postId" TEXT NOT NULL,
  "visitorKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BetAnonymousLinkOpen_pkey" PRIMARY KEY ("postId", "visitorKey")
);

ALTER TABLE "BetAnonymousLinkOpen" ADD CONSTRAINT "BetAnonymousLinkOpen_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
