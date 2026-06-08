export const WORLD_CUP_2026_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/1/17/2026_FIFA_World_Cup_emblem.svg";

export function getLeagueLogo(league, season) {
  if (Number(league?.id) === 1 && Number(season || league?.season || 2026) === 2026) {
    return WORLD_CUP_2026_LOGO;
  }
  return league?.logo || null;
}
