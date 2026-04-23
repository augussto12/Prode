/**
 * Aplicar mappings de tema post-migración.
 * Lee user-theme-mappings.json y actualiza el campo themeId de cada usuario.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
  const mappings = JSON.parse(readFileSync('./scratch/user-theme-mappings.json', 'utf-8'));

  console.log(`Aplicando ${mappings.length} mappings de tema...\n`);

  for (const { id, themeId } of mappings) {
    await prisma.user.update({
      where: { id },
      data: { themeId },
    });
    console.log(`  ✓ User #${id} → themeId="${themeId}"`);
  }

  console.log('\n✅ Todos los mappings aplicados.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
