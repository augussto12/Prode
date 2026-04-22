/**
 * Sportmonks Store (Zustand)
 * Única fuente de verdad para datos de Sportmonks en la home.
 *
 * Estado principal: smFixtures — array plano ya mergeado (live gana sobre date)
 * devuelto por el endpoint unificado /api/sportmonks/fixtures/today-complete.
 *
 * lastFetchAt guarda el timestamp del último fetch exitoso.
 * Al montar Explorer, si los datos tienen <30s no se re-fetchea.
 */
import { create } from "zustand";
import * as smService from "../services/sportmonks.service.js";

const useSportmonksStore = create((set, get) => ({
  // ── State ──
  smFixtures: [],        // Array plano de fixtures del día, ya mergeado con live
  ready: false,          // true cuando el primer fetch terminó
  lastFetchAt: 0,        // Date.now() del último fetch exitoso
  selectedFixture: null,
  selectedTeam: null,
  playerStats: [],
  standings: null,
  loading: false,
  error: null,

  // ── Actions ──

  /**
   * Fetch unificado: llama a /api/sportmonks/fixtures/today-complete
   * que ya trae live + date mergeados y ordenados del servidor.
   * Si falla, NO limpia smFixtures — mantiene datos anteriores.
   */
  fetchToday: async (date) => {
    try {
      const data = await smService.fetchTodayComplete(date);
      set({
        smFixtures: data.fixtures || [],
        ready: true,
        lastFetchAt: Date.now(),
      });
    } catch (err) {
      console.error("[SM Store] fetchToday error:", err.message);
      // NO limpiar smFixtures — mantener datos anteriores
      // Solo marcar ready para no bloquear la UI en carga inicial
      const state = get();
      if (!state.ready) {
        set({ ready: true });
      }
    }
  },

  /** Cargar detalle de un fixture */
  fetchFixture: async (id) => {
    set({ loading: true, error: null, selectedFixture: null });
    try {
      const data = await smService.fetchFixtureById(id);
      set({ selectedFixture: data, loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  /** Cargar player stats de un fixture */
  fetchPlayerStats: async (id) => {
    try {
      const data = await smService.fetchFixturePlayerStats(id);
      set({ playerStats: data || [] });
    } catch (err) {
      console.error("[SM Store] fetchPlayerStats error:", err.message);
    }
  },

  /** Cargar standings de una liga */
  fetchStandings: async (leagueId) => {
    set({ loading: true, standings: null });
    try {
      const data = await smService.fetchStandings(leagueId);
      set({ standings: data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /**
   * Actualizar un solo fixture (llamado por Socket.io).
   * Actualiza en smFixtures y selectedFixture si coincide.
   */
  updateFixture: (updatedFixture) => {
    const state = get();

    const updatedFixtures = state.smFixtures.map((f) =>
      f.externalId === updatedFixture.externalId
        ? { ...f, ...updatedFixture }
        : f,
    );

    const updatedSelected =
      state.selectedFixture?.externalId === updatedFixture.externalId
        ? { ...state.selectedFixture, ...updatedFixture }
        : state.selectedFixture;

    set({
      smFixtures: updatedFixtures,
      selectedFixture: updatedSelected,
    });
  },

  /** Limpiar fixture seleccionado */
  clearSelectedFixture: () => set({ selectedFixture: null, playerStats: [] }),

  /** Cargar detalle de equipo */
  fetchTeam: async (id) => {
    set({ loading: true, error: null, selectedTeam: null });
    try {
      const data = await smService.fetchTeam(id);
      set({ selectedTeam: data, loading: false });
    } catch (err) {
      set({ error: err?.response?.data?.error || err.message, loading: false });
    }
  },

  /** Limpiar equipo seleccionado */
  clearSelectedTeam: () => set({ selectedTeam: null }),
}));

export default useSportmonksStore;
