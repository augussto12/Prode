import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getThemeById, DEFAULT_THEME } from "../constants/themes";

/**
 * Aplica los colores del tema a las CSS custom properties del document.
 * Todos los componentes que usan var(--color-primary) etc. se actualizan automáticamente.
 */
function applyToCss(theme) {
  const root = document.documentElement;
  root.style.setProperty("--primary-color", theme.primaryColor);
  root.style.setProperty("--secondary-color", theme.secondaryColor);
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--bg-start-color", theme.bgGradientFrom);
  root.style.setProperty("--bg-end-color", theme.bgGradientTo);

  // Fix overscroll bounce — ambos backgrounds iguales para evitar flash
  document.documentElement.style.backgroundColor = theme.bgGradientFrom;
  document.body.style.backgroundColor = theme.bgGradientFrom;

  // Actualizar meta theme-color para status bar en mobile
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.bgGradientFrom);
}

const useThemeStore = create(
  persist(
    (set) => ({
      themeId: "default",

      /**
       * Aplicar tema por ID.
       * Se llama desde el ThemeSelector en Profile y al iniciar la app.
       */
      setThemeById: (themeId) => {
        const theme = getThemeById(themeId);
        set({ themeId });
        applyToCss(theme);
      },

      /**
       * Inicializar tema desde el perfil del usuario (post-login).
       * El themeId de BD tiene prioridad sobre el de localStorage.
       */
      initFromUser: (user) => {
        const themeId = user?.themeId || "default";
        const theme = getThemeById(themeId);
        set({ themeId });
        applyToCss(theme);
      },

      /**
       * Reset al tema por defecto.
       */
      reset: () => {
        set({ themeId: "default" });
        applyToCss(DEFAULT_THEME);
      },
    }),
    {
      name: "user-theme", // key en localStorage
      // Al rehidratar desde localStorage, aplicar CSS inmediatamente
      onRehydrateStorage: () => (state) => {
        if (state?.themeId) {
          const theme = getThemeById(state.themeId);
          applyToCss(theme);
        }
      },
    },
  ),
);

export default useThemeStore;
