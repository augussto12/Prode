import fetch from 'node-fetch';

const API_BASE = 'https://v3.football.api-sports.io';
const API_KEY = '23eac85ce54c183a6aaf21951f1ef7bd'; // Using the key from the codebase

async function testCoach() {
  try {
    // Argentina's team ID in API-Football for World Cup 2022 is 26
    const res = await fetch(`${API_BASE}/coachs?team=26`, {
      headers: { 'x-apisports-key': API_KEY }
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testCoach();
