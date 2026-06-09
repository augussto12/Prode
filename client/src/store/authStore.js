import { create } from "zustand";
import api, { getApiErrorMessage } from "../services/api.js";

const useAuthStore = create((set, get) => ({
  // User data se guarda en localStorage para persistencia de UI
  // pero el TOKEN ya NO se guarda en localStorage (vive en cookie HttpOnly)
  user: JSON.parse(localStorage.getItem("prode_user") || "null"),
  loading: false,
  error: null,

  login: async (login, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/login", { login, password });
      // Solo guardar datos de usuario en localStorage (NO el token)
      localStorage.setItem("prode_user", JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data;
    } catch (err) {
      const msg = getApiErrorMessage(err, "No se pudo iniciar sesion.");
      set({ error: msg, loading: false });
      throw err;
    }
  },

  register: async (email, username, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/register", {
        email,
        username,
        password,
        displayName,
      });
      set({ loading: false });
      return data;
    } catch (err) {
      const msg = getApiErrorMessage(err, "No se pudo crear la cuenta.");
      set({ error: msg, loading: false });
      throw err;
    }
  },

  verifyEmail: async (token) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/verify-email", { token });
      localStorage.setItem("prode_user", JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data;
    } catch (err) {
      const msg = getApiErrorMessage(err, "No se pudo verificar el email.");
      set({ error: msg, loading: false });
      throw err;
    }
  },

  resendVerification: async (email) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/resend-verification", { email });
      set({ loading: false });
      return data;
    } catch (err) {
      const msg = getApiErrorMessage(err, "No se pudo reenviar el email.");
      set({ error: msg, loading: false });
      throw err;
    }
  },

  forgotPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      set({ loading: false });
      return data;
    } catch (err) {
      const msg = getApiErrorMessage(err, "No se pudo enviar el reset.");
      set({ error: msg, loading: false });
      throw err;
    }
  },

  resetPassword: async (token, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      set({ loading: false });
      return data;
    } catch (err) {
      const msg = getApiErrorMessage(err, "No se pudo actualizar la contrasena.");
      set({ error: msg, loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout"); // Server limpia la cookie
    } catch (e) {
      /* ignore */
    }
    localStorage.removeItem("prode_user");
    set({ user: null });
  },

  clearError: () => set({ error: null }),

  fetchProfile: async () => {
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("prode_user", JSON.stringify(data));
      set({ user: data });
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  },

  // Helpers derivados
  get isAuthenticated() {
    return !!get().user;
  },
  isAdmin: () => ["ADMIN", "SUPERADMIN"].includes(get().user?.role),
  isSuperAdmin: () => get().user?.role === "SUPERADMIN",
}));

export default useAuthStore;
