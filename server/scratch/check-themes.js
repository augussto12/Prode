/**
 * Script de diagnóstico pre-migración.
 * Verifica si hay grupos o usuarios con colores personalizados (distintos del default).
 * Ejecutar ANTES de correr la migración.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULTS = {
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  accentColor: '#f59e0b',
  bgGradientFrom: '#0f172a',
  bgGradientTo: '#1e1b4b',
};

const USER_DEFAULTS = {
  themePrimary: '#6366f1',
  themeSecondary: '#8b5cf6',
  themeAccent: '#f59e0b',
  themeBgFrom: '#0f172a',
  themeBgTo: '#1e1b4b',
};

async function main() {
  console.log('=== DIAGNÓSTICO PRE-MIGRACIÓN ===\n');

  // 1. Verificar grupos con colores custom
  const allGroups = await prisma.group.findMany({
    select: {
      id: true, name: true,
      primaryColor: true, secondaryColor: true, accentColor: true,
      bgGradientFrom: true, bgGradientTo: true,
      createdById: true,
    }
  });

  const customGroups = allGroups.filter(g =>
    g.primaryColor !== DEFAULTS.primaryColor ||
    g.secondaryColor !== DEFAULTS.secondaryColor ||
    g.accentColor !== DEFAULTS.accentColor ||
    g.bgGradientFrom !== DEFAULTS.bgGradientFrom ||
    g.bgGradientTo !== DEFAULTS.bgGradientTo
  );

  console.log(`Total grupos: ${allGroups.length}`);
  console.log(`Grupos con colores custom: ${customGroups.length}`);
  if (customGroups.length > 0) {
    customGroups.forEach(g => {
      console.log(`  - Grupo #${g.id} "${g.name}" (admin userId: ${g.createdById})`);
      console.log(`    primary=${g.primaryColor} secondary=${g.secondaryColor} accent=${g.accentColor}`);
      console.log(`    bgFrom=${g.bgGradientFrom} bgTo=${g.bgGradientTo}`);
    });
  }

  // 2. Verificar usuarios con colores custom
  const allUsers = await prisma.user.findMany({
    select: {
      id: true, username: true,
      themePrimary: true, themeSecondary: true, themeAccent: true,
      themeBgFrom: true, themeBgTo: true,
    }
  });

  const customUsers = allUsers.filter(u =>
    (u.themePrimary && u.themePrimary !== USER_DEFAULTS.themePrimary) ||
    (u.themeSecondary && u.themeSecondary !== USER_DEFAULTS.themeSecondary) ||
    (u.themeAccent && u.themeAccent !== USER_DEFAULTS.themeAccent) ||
    (u.themeBgFrom && u.themeBgFrom !== USER_DEFAULTS.themeBgFrom) ||
    (u.themeBgTo && u.themeBgTo !== USER_DEFAULTS.themeBgTo)
  );

  console.log(`\nTotal usuarios: ${allUsers.length}`);
  console.log(`Usuarios con colores custom: ${customUsers.length}`);
  if (customUsers.length > 0) {
    customUsers.forEach(u => {
      console.log(`  - User #${u.id} @${u.username}`);
      console.log(`    primary=${u.themePrimary} secondary=${u.themeSecondary} accent=${u.themeAccent}`);
      console.log(`    bgFrom=${u.themeBgFrom} bgTo=${u.themeBgTo}`);
    });
  }

  console.log('\n=== FIN DIAGNÓSTICO ===');
  if (customGroups.length === 0 && customUsers.length === 0) {
    console.log('✅ No hay datos custom. Podés migrar directamente.');
  } else {
    console.log('⚠️  HAY DATOS CUSTOM. Correr mapeo antes de migrar.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
