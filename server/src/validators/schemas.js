import { z } from 'zod';

// --- AUTH ---
export const registerSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  username: z.string().min(3, 'Mínimo 3 caracteres').max(20, 'Máximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guion bajo'),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(100),
  displayName: z.string().min(1).max(30).optional(),
});

export const loginSchema = z.object({
  login: z.string().min(1, 'Campo requerido').max(255),
  password: z.string().min(1, 'Campo requerido').max(100),
});

// --- PROFILE ---
const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(30).optional(),
  avatar: z.string().url().max(500).optional().nullable(),
  themePrimary: z.string().regex(hexColorRegex, 'Color inválido').optional().nullable(),
  themeSecondary: z.string().regex(hexColorRegex, 'Color inválido').optional().nullable(),
  themeAccent: z.string().regex(hexColorRegex, 'Color inválido').optional().nullable(),
  themeBgFrom: z.string().regex(hexColorRegex, 'Color inválido').optional().nullable(),
  themeBgTo: z.string().regex(hexColorRegex, 'Color inválido').optional().nullable(),
}).strict(); // STRICT: rechaza campos extra (previene mass assignment de role, email, password)

// --- PREDICTIONS ---
export const predictionSchema = z.object({
  homeGoals: z.number().int().min(0).max(20).optional().nullable(),
  awayGoals: z.number().int().min(0).max(20).optional().nullable(),
  winner: z.enum(['HOME', 'AWAY', 'DRAW']).optional().nullable(),
  doubleChance: z.enum(['1X', '2X', '12']).optional().nullable(),
  btts: z.boolean().optional().nullable(),
  overUnder25: z.enum(['OVER', 'UNDER']).optional().nullable(),
  moreShots: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  moreCorners: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  isJoker: z.boolean().optional().default(false),
});

// --- GROUPS ---
export const groupCreateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(50, 'Máximo 50 caracteres').trim(),
  description: z.string().max(500).optional().default(''),
  isPublic: z.boolean().optional().default(false),
  primaryColor: z.string().regex(hexColorRegex).optional(),
  secondaryColor: z.string().regex(hexColorRegex).optional(),
  accentColor: z.string().regex(hexColorRegex).optional(),
  bgGradientFrom: z.string().regex(hexColorRegex).optional(),
  bgGradientTo: z.string().regex(hexColorRegex).optional(),
});

export const groupThemeSchema = z.object({
  primaryColor: z.string().regex(hexColorRegex).optional(),
  secondaryColor: z.string().regex(hexColorRegex).optional(),
  accentColor: z.string().regex(hexColorRegex).optional(),
  bgGradientFrom: z.string().regex(hexColorRegex).optional(),
  bgGradientTo: z.string().regex(hexColorRegex).optional(),
});

// --- MATCH RESULT (Admin) ---
export const matchResultSchema = z.object({
  homeGoals: z.number().int().min(0).max(50),
  awayGoals: z.number().int().min(0).max(50),
  homeShots: z.number().int().min(0).max(100).optional().nullable(),
  awayShots: z.number().int().min(0).max(100).optional().nullable(),
  homeCorners: z.number().int().min(0).max(50).optional().nullable(),
  awayCorners: z.number().int().min(0).max(50).optional().nullable(),
});

// --- MESSAGES (Chat) ---
export const messageSchema = z.object({
  content: z.string().min(1, 'Mensaje vacío').max(500, 'Máximo 500 caracteres').trim(),
  groupId: z.number().int().positive(),
});

// --- GURU ---
export const guruMessageSchema = z.object({
  history: z.array(z.object({
    role: z.enum(['user', 'guru']),
    text: z.string().min(1).max(2000),
  })).min(1).max(50), // Máximo 50 mensajes de historial
});

// --- SCORING CONFIG ---
export const scoringConfigSchema = z.object({
  exactScore: z.number().int().min(0).max(100),
  correctWinner: z.number().int().min(0).max(100),
  doubleChance: z.number().int().min(0).max(100),
  btts: z.number().int().min(0).max(100),
  overUnder: z.number().int().min(0).max(100),
  moreShots: z.number().int().min(0).max(100),
  moreCorners: z.number().int().min(0).max(100),
});

// --- ROLE UPDATE ---
export const roleUpdateSchema = z.object({
  role: z.enum(['PLAYER', 'ADMIN', 'SUPERADMIN']),
});
