export const WORLD_CUP_2026_LOGO =
  'https://upload.wikimedia.org/wikipedia/commons/1/17/2026_FIFA_World_Cup_emblem.svg';

export function withWorldCupLogo(competition) {
  if (!competition) return competition;
  if (Number(competition.externalId) === 1 && Number(competition.season) === 2026) {
    return { ...competition, logo: WORLD_CUP_2026_LOGO };
  }
  return competition;
}
