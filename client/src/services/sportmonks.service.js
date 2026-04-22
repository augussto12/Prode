/**
 * Sportmonks Service Layer
 * Consume /api/sportmonks/* endpoints
 */
import api from "./api";

/** Partidos en vivo de Sportmonks */
export const fetchLiveFixtures = () =>
  api.get("/sportmonks/fixtures/live").then((r) => r.data);

/** Fixtures por fecha (YYYY-MM-DD) */
export const fetchFixturesByDate = (date) =>
  api.get(`/sportmonks/fixtures/date/${date}`).then((r) => r.data);

/** Detalle base de un fixture */
export const fetchFixtureById = (id) =>
  api.get(`/sportmonks/fixtures/${id}`).then((r) => r.data);

/** Formaciones del fixture */
export const fetchFixtureLineups = (id) =>
  api.get(`/sportmonks/fixtures/${id}/lineups`).then((r) => r.data);

/** Eventos del fixture */
export const fetchFixtureEvents = (id) =>
  api.get(`/sportmonks/fixtures/${id}/events`).then((r) => r.data);

/** Estadísticas del fixture */
export const fetchFixtureStatistics = (id) =>
  api.get(`/sportmonks/fixtures/${id}/statistics`).then((r) => r.data);

/** H2H */
export const fetchFixtureH2H = (team1Id, team2Id) =>
  api.get(`/sportmonks/fixtures/any/h2h/${team1Id}/${team2Id}`).then((r) => r.data);

/** Player stats de un fixture */
export const fetchFixturePlayerStats = (id) =>
  api.get(`/sportmonks/fixtures/${id}/player-stats`).then((r) => r.data);

/** Standings de una liga */
export const fetchStandings = (leagueId) =>
  api.get(`/sportmonks/standings/${leagueId}`).then((r) => r.data);

/** Ligas cubiertas */
export const fetchLeagues = () =>
  api.get("/sportmonks/leagues").then((r) => r.data);

/** Detalle de equipo */
export const fetchTeam = (teamId) =>
  api.get(`/sportmonks/teams/${teamId}/full`).then((r) => r.data);

/** Detalle de jugador */
export const fetchPlayer = (playerId) =>
  api.get(`/sportmonks/players/${playerId}`).then((r) => r.data);

/** Fixtures del día ya mergeados con live (endpoint unificado) */
export const fetchTodayComplete = (date) =>
  api.get(`/sportmonks/fixtures/today-complete?date=${date}`).then((r) => r.data);
