import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando borrado controlado de datos...');
  
  // Wipe Predictions (depends on Match & GroupUser)
  await prisma.prediction.deleteMany({});
  await prisma.outrightPrediction.deleteMany({});
  
  // Wipe DreamTeams (depends on Player/Team)
  await prisma.dreamTeam.deleteMany({});
  
  // Wipe everything tied to Group or Match
  await prisma.message.deleteMany({});
  await prisma.groupUser.deleteMany({});
  await prisma.group.deleteMany({});
  
  // Wipe Matches & Events
  await prisma.matchEvent.deleteMany({});
  await prisma.match.deleteMany({});

  // Wipe Players
  await prisma.player.deleteMany({});
  
  // Wipe Teams
  await prisma.favorite.deleteMany({});
  await prisma.team.deleteMany({});

  console.log('Todo el contenido asimilado a torneos ha sido eliminado.');
  console.log('Los Usuarios siguen intactos.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
