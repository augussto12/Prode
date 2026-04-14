import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const players = [
  { name: 'Emiliano Martínez', country: 'Argentina', position: 'GK', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 6.0 },
  { name: 'Alisson Becker', country: 'Brasil', position: 'GK', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 6.0 },
  { name: 'Thibaut Courtois', country: 'Bélgica', position: 'GK', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 5.5 },
  
  { name: 'Cristian Romero', country: 'Argentina', position: 'DEF', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 6.5 },
  { name: 'Virgil van Dijk', country: 'Países Bajos', position: 'DEF', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 7.0 },
  { name: 'Marquinhos', country: 'Brasil', position: 'DEF', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 6.0 },
  { name: 'Achraf Hakimi', country: 'Marruecos', position: 'DEF', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 6.5 },
  { name: 'Lisandro Martínez', country: 'Argentina', position: 'DEF', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 5.5 },

  { name: 'Kevin De Bruyne', country: 'Bélgica', position: 'MID', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 9.0 },
  { name: 'Alexis Mac Allister', country: 'Argentina', position: 'MID', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 7.5 },
  { name: 'Jude Bellingham', country: 'Inglaterra', position: 'MID', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 8.5 },
  { name: 'Luka Modric', country: 'Croacia', position: 'MID', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 8.0 },
  { name: 'Enzo Fernández', country: 'Argentina', position: 'MID', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 7.0 },
  { name: 'Pedri', country: 'España', position: 'MID', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 8.0 },

  { name: 'Lionel Messi', country: 'Argentina', position: 'FWD', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 10.0 },
  { name: 'Kylian Mbappé', country: 'Francia', position: 'FWD', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 10.0 },
  { name: 'Vinícius Júnior', country: 'Brasil', position: 'FWD', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 9.5 },
  { name: 'Erling Haaland', country: 'Noruega', position: 'FWD', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 9.5 },
  { name: 'Julián Álvarez', country: 'Argentina', position: 'FWD', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 8.5 },
  { name: 'Harry Kane', country: 'Inglaterra', position: 'FWD', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', price: 9.0 }
];

async function main() {
  console.log('Borrand jugadores antiguos...');
  await prisma.player.deleteMany();
  
  console.log('Seeding ' + players.length + ' jugadores...');
  for (const p of players) {
    await prisma.player.create({ data: p });
  }
  console.log('Jugadores creados exitosamente!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
