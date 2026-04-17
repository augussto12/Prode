/**
 * Migration Script: matchId → externalFixtureId
 * 
 * 1. Adds new columns to Prediction table
 * 2. Fills them from the Match table join
 * 3. Must be run BEFORE schema changes (while Match table still exists)
 * 
 * Usage: node prisma/migrate-predictions.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🔄 Starting prediction migration: matchId → externalFixtureId...\n');

  // Step 1: Add new columns (IF NOT EXISTS for idempotency)
  console.log('📦 Step 1: Adding new columns...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "externalFixtureId" INTEGER;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "competitionId" INTEGER;
  `);
  console.log('   ✓ Columns added\n');

  // Step 2: Fill from Match table in a single UPDATE (no N+1)
  console.log('📊 Step 2: Migrating data from Match → Prediction...');
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Prediction" p
    SET "externalFixtureId" = m."externalId",
        "competitionId" = m."competitionId"
    FROM "Match" m
    WHERE p."matchId" = m.id
      AND m."externalId" IS NOT NULL
  `);
  console.log(`   ✓ ${result} predictions updated\n`);

  // Step 3: Check for orphans (predictions whose Match had no externalId)
  const orphans = await prisma.$queryRawUnsafe(`
    SELECT p.id, p."matchId" 
    FROM "Prediction" p 
    WHERE p."externalFixtureId" IS NULL
  `);

  if (orphans.length > 0) {
    console.warn(`⚠️  ${orphans.length} predictions could not be migrated (Match has no externalId):`);
    orphans.forEach(o => console.warn(`   - Prediction ID: ${o.id}, matchId: ${o.matchId}`));
  } else {
    console.log('   ✓ All predictions migrated successfully (0 orphans)');
  }

  console.log('\n✅ Migration complete. You can now update schema.prisma and run prisma db push.');

  await prisma.$disconnect();
}

migrate().catch(err => {
  console.error('💀 Migration failed:', err);
  process.exit(1);
});
