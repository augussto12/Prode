/**
 * Temas predefinidos para la app.
 * Cada tema tiene colores coordinados y probados.
 * El usuario elige uno desde su perfil y se aplica globalmente.
 */
export const THEMES = [
  {
    id: 'default',
    name: 'Índigo',
    preview: ['#6366f1', '#8b5cf6', '#0f0f2e'],
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    accentColor: '#f59e0b',
    bgGradientFrom: '#0f0f2e',  // azul índigo oscuro con tinte
    bgGradientTo: '#1a1050',    // más índigo/violeta
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    preview: ['#10b981', '#059669', '#022c22'],
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    accentColor: '#34d399',
    bgGradientFrom: '#022c22',
    bgGradientTo: '#064e3b',
  },
  {
    id: 'rose',
    name: 'Rosa',
    preview: ['#f43f5e', '#e11d48', '#1a0010'],
    primaryColor: '#f43f5e',
    secondaryColor: '#e11d48',
    accentColor: '#fb7185',
    bgGradientFrom: '#1a0010',
    bgGradientTo: '#3b0020',
  },
  {
    id: 'amber',
    name: 'Ámbar',
    preview: ['#f59e0b', '#d97706', '#1a1000'],
    primaryColor: '#f59e0b',
    secondaryColor: '#d97706',
    accentColor: '#fcd34d',
    bgGradientFrom: '#1a1000',
    bgGradientTo: '#2d1f00',
  },
  {
    id: 'sky',
    name: 'Cielo',
    preview: ['#0ea5e9', '#0284c7', '#001a2e'],
    primaryColor: '#0ea5e9',
    secondaryColor: '#0284c7',
    accentColor: '#38bdf8',
    bgGradientFrom: '#001a2e',
    bgGradientTo: '#0c2a3e',
  },
  {
    id: 'slate',
    name: 'Oscuro',
    preview: ['#94a3b8', '#64748b', '#020617'],
    primaryColor: '#94a3b8',    // gris claro (más legible)
    secondaryColor: '#64748b',  // gris medio
    accentColor: '#cbd5e1',
    bgGradientFrom: '#020617',
    bgGradientTo: '#0f172a',
    // Tema oscuro mínimalista — fondos apagados intencionalmente
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    preview: ['#d946ef', '#06b6d4', '#0d0221'],
    primaryColor: '#d946ef',    // magenta
    secondaryColor: '#06b6d4',  // cyan
    accentColor: '#facc15',
    bgGradientFrom: '#0d0221',  // violeta muy oscuro
    bgGradientTo: '#001a1a',    // cyan muy oscuro — fondo dividido
  },
  {
    id: 'sunset',
    name: 'Atardecer',
    preview: ['#f97316', '#e11d48', '#2a0a18'],
    primaryColor: '#f97316',
    secondaryColor: '#e11d48',
    accentColor: '#f87171',
    bgGradientFrom: '#2a0a18',
    bgGradientTo: '#431407',
  },
  {
    id: 'galaxy',
    name: 'Galaxia',
    preview: ['#a855f7', '#ec4899', '#0d0520'],
    primaryColor: '#a855f7',
    secondaryColor: '#ec4899',
    accentColor: '#2dd4bf',
    bgGradientFrom: '#0d0520',  // violeta espacial
    bgGradientTo: '#200a20',    // rosa espacial oscuro
  },
  {
    id: 'forest',
    name: 'Bosque',
    preview: ['#22c55e', '#15803d', '#052e16'],
    primaryColor: '#22c55e',
    secondaryColor: '#15803d',
    accentColor: '#86efac',
    bgGradientFrom: '#052e16',
    bgGradientTo: '#14532d',
  },
  {
    id: 'ocean',
    name: 'Océano',
    preview: ['#06b6d4', '#0891b2', '#001e2b'],
    primaryColor: '#06b6d4',
    secondaryColor: '#0891b2',
    accentColor: '#67e8f9',
    bgGradientFrom: '#001e2b',
    bgGradientTo: '#0c3547',
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    preview: ['#818cf8', '#c084fc', '#05051a'],
    primaryColor: '#818cf8',
    secondaryColor: '#c084fc',  // violeta más claro (era #6366f1, muy similar a primary)
    accentColor: '#c7d2fe',
    bgGradientFrom: '#05051a',  // azul nocturno
    bgGradientTo: '#120524',    // violeta nocturno
  },
  {
    id: 'neon',
    name: 'Neón',
    preview: ['#22d3ee', '#a855f7', '#001820'],
    primaryColor: '#22d3ee',    // cyan
    secondaryColor: '#a855f7',  // violeta
    accentColor: '#f0abfc',     // rosa claro
    bgGradientFrom: '#001820',  // cyan muy oscuro
    bgGradientTo: '#1a0533',    // violeta muy oscuro
  },
  {
    id: 'fire',
    name: 'Fuego',
    preview: ['#f97316', '#a855f7', '#1a0800'],
    primaryColor: '#f97316',    // naranja
    secondaryColor: '#a855f7',  // violeta
    accentColor: '#fb923c',     // naranja claro
    bgGradientFrom: '#1a0800',  // naranja muy oscuro
    bgGradientTo: '#1a0530',    // violeta oscuro
  },
  {
    id: 'tropical',
    name: 'Tropical',
    preview: ['#10b981', '#f59e0b', '#001a0d'],
    primaryColor: '#10b981',    // verde
    secondaryColor: '#f59e0b',  // amarillo/dorado
    accentColor: '#34d399',     // verde claro
    bgGradientFrom: '#001a0d',  // verde selva oscuro
    bgGradientTo: '#1a0f00',    // dorado oscuro
  },
  {
    id: 'royal',
    name: 'Real',
    preview: ['#3b82f6', '#d4af37', '#020b1a'],
    primaryColor: '#3b82f6',    // azul real
    secondaryColor: '#d4af37',  // dorado
    accentColor: '#fbbf24',     // dorado claro
    bgGradientFrom: '#020b1a',  // azul real oscuro
    bgGradientTo: '#0a1a3a',    // azul más intenso
  },
  {
    id: 'aurora',
    name: 'Aurora',
    preview: ['#34d399', '#818cf8', '#001a10'],
    primaryColor: '#34d399',    // verde menta
    secondaryColor: '#818cf8',  // violeta suave
    accentColor: '#f0abfc',     // rosa
    bgGradientFrom: '#001a10',  // verde muy oscuro
    bgGradientTo: '#0d0a25',    // violeta muy oscuro
  },
  {
    id: 'lava',
    name: 'Lava',
    preview: ['#ef4444', '#0ea5e9', '#1a0505'],
    primaryColor: '#ef4444',    // rojo
    secondaryColor: '#0ea5e9',  // celeste
    accentColor: '#fca5a5',     // rojo claro
    bgGradientFrom: '#1a0505',  // rojo oscuro
    bgGradientTo: '#050f1a',    // azul oscuro
  },
  {
    id: 'gold',
    name: 'Dorado',
    preview: ['#d4af37', '#b45309', '#150f00'],
    primaryColor: '#d4af37',    // dorado
    secondaryColor: '#b45309',  // bronce/cobre
    accentColor: '#fcd34d',     // amarillo claro
    bgGradientFrom: '#150f00',  // dorado muy oscuro
    bgGradientTo: '#0a0600',    // casi negro cálido
  },
];

export const VALID_THEME_IDS = THEMES.map(t => t.id);

export const DEFAULT_THEME = THEMES[0];

export const getThemeById = (id) =>
  THEMES.find(t => t.id === id) || DEFAULT_THEME;
