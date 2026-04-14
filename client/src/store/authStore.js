import { create } from 'zustand';
import api from '../services/api.js';

const useAuthStore = create((set, get) => ({
  // User data se guarda en localStorage para persistencia de UI
  // pero el TOKEN ya NO se guarda en localStorage (vive en cookie HttpOnly)
  user: JSON.parse(localStorage.getItem('prode_user') || 'null'),
  loading: false,
  error: null,

  login: async (login, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { login, password });
      // Solo guardar datos de usuario en localStorage (NO el token)
      localStorage.setItem('prode_user', JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  register: async (email, username, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', { email, username, password, displayName });
      localStorage.setItem('prode_user', JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout'); // Server limpia la cookie
    } catch (e) { /* ignore */ }
    localStorage.removeItem('prode_user');
    set({ user: null });
  },

  fetchProfile: async () => {
    try {
      const { data } = await api.get('/auth/me');
      localStorage.setItem('prode_user', JSON.stringify(data));
      set({ user: data });
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  },

  // Helpers derivados
  get isAuthenticated() { return !!get().user; },
  isAdmin: () => ['ADMIN', 'SUPERADMIN'].includes(get().user?.role),
  isSuperAdmin: () => get().user?.role === 'SUPERADMIN',
}));

export default useAuthStore;
