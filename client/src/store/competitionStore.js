import { create } from 'zustand';
import api from '../services/api.js';

const useCompetitionStore = create((set, get) => ({
  competitions: [],
  activeCompetition: JSON.parse(localStorage.getItem('prode_active_competition') || 'null'),
  loading: false,

  fetchCompetitions: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/competitions');
      set({ competitions: data, loading: false });

      // Si no hay competencia activa pero hay datos, seleccionar la primera
      const current = get().activeCompetition;
      if (!current && data.length > 0) {
        get().setActive(data[0]);
      }
      // Si la activa ya no existe en la lista, resetear
      if (current && !data.find(c => c.id === current.id)) {
        if (data.length > 0) {
          get().setActive(data[0]);
        } else {
          set({ activeCompetition: null });
          localStorage.removeItem('prode_active_competition');
        }
      }
    } catch (err) {
      console.error('Error fetching competitions:', err);
      set({ loading: false });
    }
  },

  setActive: (competition) => {
    localStorage.setItem('prode_active_competition', JSON.stringify(competition));
    set({ activeCompetition: competition });
  },
}));

export default useCompetitionStore;
