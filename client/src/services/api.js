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
    const requestUrl = error.config?.url || "";
    const isAuthFormRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/verify-email") ||
      requestUrl.includes("/auth/resend-verification") ||
      requestUrl.includes("/auth/forgot-password") ||
      requestUrl.includes("/auth/reset-password");

    if (error.response?.status === 401 && !isAuthFormRequest) {
      // Si el usuario supuestamente estaba logueado y el token expiró, limpiamos y mandamos al login
      if (localStorage.getItem("prode_user")) {
        localStorage.removeItem("prode_user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error, fallback = "Ocurrio un error. Intenta de nuevo.") {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.code === "ECONNABORTED") return "El servidor tardo demasiado en responder.";
  if (!error.response) return "No se pudo conectar con el servidor.";
  return fallback;
}

export default api;
