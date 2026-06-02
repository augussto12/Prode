DO $$
BEGIN
  CREATE TYPE "GroupJoinPolicy" AS ENUM ('OPEN_WITH_CODE', 'WHITELIST_WITH_CODE', 'INVITE_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Group"
  ADD COLUMN IF NOT EXISTS "joinPolicy" "GroupJoinPolicy" NOT NULL DEFAULT 'OPEN_WITH_CODE';

CREATE TABLE IF NOT EXISTS "GroupInvite" (
  "id" SERIAL NOT NULL,
  "groupId" INTEGER NOT NULL,
  "username" TEXT NOT NULL,
  "normalizedUsername" TEXT NOT NULL,
  "invitedById" INTEGER,
  "status" "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedById" INTEGER,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Group_joinPolicy_idx" ON "Group"("joinPolicy");
CREATE UNIQUE INDEX IF NOT EXISTS "GroupInvite_groupId_normalizedUsername_key" ON "GroupInvite"("groupId", "normalizedUsername");
CREATE INDEX IF NOT EXISTS "GroupInvite_groupId_status_idx" ON "GroupInvite"("groupId", "status");
CREATE INDEX IF NOT EXISTS "GroupInvite_normalizedUsername_idx" ON "GroupInvite"("normalizedUsername");
CREATE INDEX IF NOT EXISTS "GroupInvite_acceptedById_idx" ON "GroupInvite"("acceptedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupInvite_groupId_fkey'
  ) THEN
    ALTER TABLE "GroupInvite"
      ADD CONSTRAINT "GroupInvite_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupInvite_invitedById_fkey'
  ) THEN
    ALTER TABLE "GroupInvite"
      ADD CONSTRAINT "GroupInvite_invitedById_fkey"
      FOREIGN KEY ("invitedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupInvite_acceptedById_fkey'
  ) THEN
    ALTER TABLE "GroupInvite"
      ADD CONSTRAINT "GroupInvite_acceptedById_fkey"
      FOREIGN KEY ("acceptedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
