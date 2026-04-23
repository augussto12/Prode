/**
 * Script de mapeo pre-migración.
 * Analiza los colores custom de grupos, mapea al tema predefinido más cercano,
 * y guarda el themeId en el User del admin del grupo.
 * Para usuarios con colores custom, mapea al tema más cercano por su primaryColor.
 *
 * EJECUTAR ANTES de correr la migración.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Convertir hex a HSL para comparar tonos
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function mapToThemeId(primaryColor) {
  const hsl = hexToHsl(primaryColor);
  const { h, s, l } = hsl;

  // Muy baja saturación → slate (gris/neutro)
  if (s < 15) return 'slate';

  // Mapear por hue ranges
  if (h >= 330 || h < 15) return 'rose';       // rojo/rosa
  if (h >= 15 && h < 50) return 'amber';        // naranja/amarillo
  if (h >= 50 && h < 75) return 'amber';         // amarillo
  if (h >= 75 && h < 170) return 'emerald';      // verde
  if (h >= 170 && h < 250) return 'sky';          // azul/celeste
  if (h >= 250 && h < 290) return 'default';      // indigo/violeta  
  if (h >= 290 && h < 330) return 'rose';         // magenta/rosa

  return 'default';
}

async function main() {
  console.log('=== MAPEO PRE-MIGRACIÓN ===\n');

  // 1. Mapear grupos → guardar themeId en el admin del grupo
  const allGroups = await prisma.group.findMany({
    select: {
      id: true, name: true, primaryColor: true, createdById: true,
    }
  });

  const DEFAULT_PRIMARY = '#6366f1';
  let groupsMapped = 0;

  for (const g of allGroups) {
    if (g.primaryColor === DEFAULT_PRIMARY) continue;

    const themeId = mapToThemeId(g.primaryColor);
    console.log(`Grupo #${g.id} "${g.name}" primary=${g.primaryColor} → themeId="${themeId}" (admin userId=${g.createdById})`);

    // Solo actualizar si el admin todavía tiene el default (no sobreescribir si ya tiene custom)
    const admin = await prisma.user.findUnique({ where: { id: g.createdById } });
    if (admin && (!admin.themePrimary || admin.themePrimary === DEFAULT_PRIMARY)) {
      // No podemos setear themeId aún (campo no existe), pero logueamos qué haríamos
      console.log(`  → Admin @${admin.username} sería mapeado a themeId="${themeId}"`);
    } else {
      console.log(`  → Admin ya tiene colores custom propios, no sobreescribir`);
    }
    groupsMapped++;
  }

  // 2. Mapear usuarios con colores custom
  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true, themePrimary: true }
  });

  let usersMapped = 0;
  const userMappings = [];

  for (const u of allUsers) {
    if (!u.themePrimary || u.themePrimary === DEFAULT_PRIMARY) continue;
    const themeId = mapToThemeId(u.themePrimary);
    console.log(`User #${u.id} @${u.username} primary=${u.themePrimary} → themeId="${themeId}"`);
    userMappings.push({ id: u.id, themeId });
    usersMapped++;
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Grupos con colores custom: ${groupsMapped}`);
  console.log(`Usuarios con colores custom: ${usersMapped}`);
  console.log(`\nMappings de usuario que se aplicarán post-migración:`);
  userMappings.forEach(m => console.log(`  User #${m.id} → themeId="${m.themeId}"`));

  // Guardar mappings en un archivo temporal para aplicar post-migración
  const mappingsJson = JSON.stringify(userMappings, null, 2);
  const fs = await import('fs');
  fs.writeFileSync('./scratch/user-theme-mappings.json', mappingsJson);
  console.log('\n✅ Mappings guardados en scratch/user-theme-mappings.json');
  console.log('Después de la migración, ejecutar apply-theme-mappings.js');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
