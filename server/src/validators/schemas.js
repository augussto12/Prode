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
  themeId: z.enum(['default', 'emerald', 'rose', 'amber', 'sky', 'slate', 'cyberpunk', 'sunset', 'galaxy', 'forest', 'ocean', 'midnight', 'neon', 'fire', 'tropical', 'royal', 'aurora', 'lava', 'gold']).optional(),
}).strict(); // STRICT: rechaza campos extra (previene mass assignment de role, email, password)

// --- FAVORITES ---
export const favoritesSchema = z.object({
  teams: z.array(
    z.string().min(1, 'Nombre de equipo vacío').max(100, 'Nombre demasiado largo').trim()
  ).max(10, 'Máximo 10 equipos favoritos').default([]),
});

// --- PREDICTIONS ---
export const predictionSchema = z.object({
  externalFixtureId: z.union([z.string(), z.number()]).transform(String),
  competitionId: z.number().int().positive(),
  homeGoals: z.number().int().min(0).max(20).optional().nullable(),
  awayGoals: z.number().int().min(0).max(20).optional().nullable(),
  winner: z.enum(['HOME', 'AWAY', 'DRAW']).optional().nullable(),
  doubleChance: z.enum(['1X', '2X', '12']).optional().nullable(),
  btts: z.boolean().optional().nullable(),
  overUnder25: z.enum(['OVER', 'UNDER']).optional().nullable(),
  moreShots: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  moreCorners: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  morePossession: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  moreFouls: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  moreCards: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  moreOffsides: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  moreSaves: z.enum(['HOME', 'AWAY', 'EQUAL']).optional().nullable(),
  isJoker: z.boolean().optional().default(false),
});

// --- GROUPS ---
export const groupCreateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(50, 'Máximo 50 caracteres').trim(),
  description: z.string().max(500).optional().default(''),
  isPublic: z.boolean().optional().default(false),
  competitionId: z.number().int().positive('competitionId es requerido'),
  allowMoreShots: z.boolean().optional(),
  allowMoreCorners: z.boolean().optional(),
  allowMorePossession: z.boolean().optional(),
  allowMoreFouls: z.boolean().optional(),
  allowMoreCards: z.boolean().optional(),
  allowMoreOffsides: z.boolean().optional(),
  allowMoreSaves: z.boolean().optional(),
});

export const groupThemeSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(50, 'Máximo 50 caracteres').trim().optional(),
  description: z.string().max(500).optional(),
  allowMoreShots: z.boolean().optional(),
  allowMoreCorners: z.boolean().optional(),
  allowMorePossession: z.boolean().optional(),
  allowMoreFouls: z.boolean().optional(),
  allowMoreCards: z.boolean().optional(),
  allowMoreOffsides: z.boolean().optional(),
  allowMoreSaves: z.boolean().optional(),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().uuid('Código de invitación inválido'),
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
  moreShots: z.number().int().min(0).max(100),
  moreCorners: z.number().int().min(0).max(100),
  morePossession: z.number().int().min(0).max(100),
  moreFouls: z.number().int().min(0).max(100),
  moreCards: z.number().int().min(0).max(100),
  moreOffsides: z.number().int().min(0).max(100),
  moreSaves: z.number().int().min(0).max(100),
  overUnder: z.number().int().min(0).max(100),
});

// --- ROLE UPDATE ---
export const roleUpdateSchema = z.object({
  role: z.enum(['PLAYER', 'ADMIN', 'SUPERADMIN']),
});

// --- OUTRIGHTS ---
export const outrightPredictionSchema = z.object({
  competitionId: z.number().int().positive('competitionId es requerido'),
  championTeam: z.string().max(100).optional().nullable(),
  runnerUpTeam: z.string().max(100).optional().nullable(),
  topScorerId: z.number().int().positive().optional().nullable(),
  bestPlayerId: z.number().int().positive().optional().nullable(),
});

// --- DREAM TEAM ---
const optionalPlayerId = z.number().int().positive().optional().nullable();

export const dreamTeamSaveSchema = z.object({
  competitionId: z.number().int().positive('competitionId es requerido'),
  formation: z.string().regex(/^\d+-\d+-\d+$/, 'Formación inválida (ej: 1-2-1)').default('1-2-1'),
  players: z.object({
    gkId: optionalPlayerId,
    def1Id: optionalPlayerId,
    def2Id: optionalPlayerId,
    mid1Id: optionalPlayerId,
    mid2Id: optionalPlayerId,
    fwd1Id: optionalPlayerId,
    fwd2Id: optionalPlayerId,
  }),
});

// --- COMPETITION (Admin) ---
export const competitionCreateSchema = z.object({
  externalId: z.number().int().positive('externalId es requerido'),
  name: z.string().min(1, 'Nombre requerido').max(100).trim(),
  logo: z.string().url().max(500).optional().nullable(),
  season: z.number().int().min(1900).max(2100).optional().default(2022),
});
