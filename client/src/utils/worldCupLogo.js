export const WORLD_CUP_2026_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/1/17/2026_FIFA_World_Cup_emblem.svg";

function isWorldCup2026(league, season) {
  const leagueId = Number(league?.externalId ?? league?.id);
  const leagueSeason = Number(season ?? league?.season ?? 2026);
  return leagueId === 1 && leagueSeason === 2026;
}

const LEAGUE_NAME_TRANSLATIONS = {
  Friendlies: "Amistosos internacionales",
  "Friendly International": "Amistosos internacionales",
  "World Friendlies": "Amistosos internacionales",
};

export function getLeagueLogo(league, season) {
  if (isWorldCup2026(league, season)) {
    return WORLD_CUP_2026_LOGO;
  }
  return league?.logo || null;
}

export function getLeagueName(league, season) {
  if (isWorldCup2026(league, season)) {
    return "Copa del Mundo 2026";
  }
  return LEAGUE_NAME_TRANSLATIONS[league?.name] || league?.name || "";
}
