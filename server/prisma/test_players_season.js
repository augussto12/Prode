import fetch from 'node-fetch';

const API_BASE = 'https://v3.football.api-sports.io';
const API_KEY = '23eac85ce54c183a6aaf21951f1ef7bd';

async function testPlayers() {
  try {
    // Probamos obtener jugadores de Argentina (26) para la temporada 2022
    const res = await fetch(`${API_BASE}/players?team=26&season=2022`, {
      headers: { 'x-apisports-key': API_KEY }
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data.paging, null, 2));
    if (data.response && data.response.length > 0) {
      console.log('Player 1:', data.response[0].player.name);
      console.log('Player 2:', data.response[1].player.name);
    }
  } catch (err) {
    console.error(err);
  }
}

testPlayers();
