import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // ← CRÍTICO: envía cookies HttpOnly automáticamente
});

// Handle 401 errors globally (token expirado o inválido)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar estado local y redirigir a login
      localStorage.removeItem('prode_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
