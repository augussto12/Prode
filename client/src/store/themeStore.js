import { create } from 'zustand';

const defaultTheme = {
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  accentColor: '#f59e0b',
  bgGradientFrom: '#0f172a',
  bgGradientTo: '#1e1b4b',
};

// Regex para validar colores hex (previene CSS injection)
const isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);

// Sanitiza un color: si no es un hex válido, usa el fallback
const sanitizeColor = (value, fallback) => {
  if (typeof value === 'string' && isValidHex(value)) return value;
  return fallback;
};

// Handle both Group theme structure (primaryColor) and User theme structure (themePrimary)
const extractTheme = (source) => ({
  primaryColor: sanitizeColor(source?.themePrimary || source?.primaryColor || source?.primary, defaultTheme.primaryColor),
  secondaryColor: sanitizeColor(source?.themeSecondary || source?.secondaryColor || source?.secondary, defaultTheme.secondaryColor),
  accentColor: sanitizeColor(source?.themeAccent || source?.accentColor || source?.accent, defaultTheme.accentColor),
  bgGradientFrom: sanitizeColor(source?.themeBgFrom || source?.bgGradientFrom || source?.bgFrom, defaultTheme.bgGradientFrom),
  bgGradientTo: sanitizeColor(source?.themeBgTo || source?.bgGradientTo || source?.bgTo, defaultTheme.bgGradientTo),
});

const applyToCss = (theme) => {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', theme.primaryColor);
  root.style.setProperty('--secondary-color', theme.secondaryColor);
  root.style.setProperty('--accent-color', theme.accentColor);
  root.style.setProperty('--bg-start-color', theme.bgGradientFrom);
  root.style.setProperty('--bg-end-color', theme.bgGradientTo);
};

const useThemeStore = create((set, get) => ({
  personalTheme: defaultTheme,
  currentTheme: defaultTheme,

  setPersonalTheme: (user) => {
    const theme = extractTheme(user);
    set({ personalTheme: theme, currentTheme: theme });
    applyToCss(theme);
  },

  setTheme: (groupTheme) => {
    const theme = extractTheme(groupTheme);
    set({ currentTheme: theme });
    applyToCss(theme);
  },

  resetTheme: () => {
    const theme = get().personalTheme;
    set({ currentTheme: theme });
    applyToCss(theme);
  },
}));

export default useThemeStore;
