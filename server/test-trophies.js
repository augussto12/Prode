import fetch from 'node-fetch';

async function testApi() {
  const url = `https://v3.football.api-sports.io/trophies?team=451`;
  const res = await fetch(url, { headers: { 'x-apisports-key': '0bc3243f7ed3be4a1d82dd65ec58fdcf' } }); // using dummy key or I can read env locally
  console.log(await res.text());
}

testApi();
