import { create } from "zustand";
import api from "../services/api.js";

// Version check: si cambia el build, limpiar localStorage para evitar datos viejos
const APP_VERSION = "1.1"; // Bump this when making breaking changes
const storedVersion = localStorage.getItem("prode_app_version");
if (storedVersion !== APP_VERSION) {
  localStorage.removeItem("prode_active_competition");
  localStorage.removeItem("prode_app_version");
  localStorage.setItem("prode_app_version", APP_VERSION);
}

const useCompetitionStore = create((set, get) => ({
  competitions: [],
  activeCompetition: JSON.parse(
    localStorage.getItem("prode_active_competition") || "null",
  ),
  loading: false,

  fetchCompetitions: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get("/competitions");
      set({ competitions: data, loading: false });

      const current = get().activeCompetition;
      // Si no hay activa o la activa no está en la lista nueva, buscar Mundial
      const worldCup = data.find((c) => c.externalId === 1);
      if (!current || !data.find((c) => c.id === current.id)) {
        if (worldCup) {
          get().setActive(worldCup);
        } else if (data.length > 0) {
          get().setActive(data[0]);
        } else {
          set({ activeCompetition: null });
          localStorage.removeItem("prode_active_competition");
        }
      }
    } catch (err) {
      console.error("Error fetching competitions:", err);
      set({ loading: false });
    }
  },

  setActive: (competition) => {
    localStorage.setItem(
      "prode_active_competition",
      JSON.stringify(competition),
    );
    set({ activeCompetition: competition });
  },
}));

export default useCompetitionStore;
