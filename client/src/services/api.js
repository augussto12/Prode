import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // ← CRÍTICO: envía cookies HttpOnly automáticamente
  timeout: 15000, // 15s — evita spinners infinitos si el server no responde
});

// Handle 401 errors globally (token expirado o inválido)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Si el usuario supuestamente estaba logueado y el token expiró, limpiamos y mandamos al login
      if (localStorage.getItem("prode_user")) {
        localStorage.removeItem("prode_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
