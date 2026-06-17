import prisma from '../config/database.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { normalizePhase, PHASE_LABELS } from './phase-window.service.js';

export const LEGACY_JOKER_LIMIT = 3;

export const JOKER_PHASE_MODE = {
  AUTO_WITH_MANUAL_FALLBACK: 'AUTO_WITH_MANUAL_FALLBACK',
  FORCE_MANUAL: 'FORCE_MANUAL',
};

export const JOKER_PHASES = [
  { key: 'group', label: PHASE_LABELS.group },
  { key: 'round32', label: PHASE_LABELS.round32 },
  { key: 'round16', label: PHASE_LABELS.round16 },
  { key: 'quarter', label: PHASE_LABELS.quarter },
  { key: 'semi', label: PHASE_LABELS.semi },
  { key: 'thirdPlace', label: PHASE_LABELS.thirdPlace },
  { key: 'final', label: PHASE_LABELS.final },
];

const VALID_PHASE_KEYS = new Set(JOKER_PHASES.map((phase) => phase.key));
const VALID_PHASE_MODES = new Set(Object.values(JOKER_PHASE_MODE));

function assertValidPhaseKey(phaseKey) {
  if (!VALID_PHASE_KEYS.has(phaseKey)) {
    throw new BadRequestError('Fase x2 invalida');
  }
}

function normalizeConfig(config) {
  return {
    id: config?.id || null,
    competitionId: config?.competitionId || null,
    phaseMode: VALID_PHASE_MODES.has(config?.phaseMode)
      ? config.phaseMode
      : JOKER_PHASE_MODE.AUTO_WITH_MANUAL_FALLBACK,
    manualPhaseKey: VALID_PHASE_KEYS.has(config?.manualPhaseKey)
      ? config.manualPhaseKey
      : null,
    updatedById: config?.updatedById || null,
    createdAt: config?.createdAt || null,
    updatedAt: config?.updatedAt || null,
  };
}

export function getPhaseLabel(phaseKey) {
  return PHASE_LABELS[phaseKey] || phaseKey || 'fase actual';
}

export async function getJokerConfig(competitionId) {
  const config = await prisma.prodeJokerConfig.findUnique({
    where: { competitionId: Number(competitionId) },
  });

  return normalizeConfig(config || { competitionId: Number(competitionId) });
}

export async function updateJokerConfig(adminUserId, data) {
  const competitionId = Number(data.competitionId);
  const phaseMode = data.phaseMode || JOKER_PHASE_MODE.AUTO_WITH_MANUAL_FALLBACK;
  const manualPhaseKey = data.manualPhaseKey || null;

  if (!competitionId) throw new BadRequestError('competitionId es requerido');
  if (!VALID_PHASE_MODES.has(phaseMode)) throw new BadRequestError('Modo de fase x2 invalido');
  if (manualPhaseKey) assertValidPhaseKey(manualPhaseKey);

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) throw new NotFoundError('Competicion no encontrada');

  return prisma.prodeJokerConfig.upsert({
    where: { competitionId },
    update: {
      phaseMode,
      manualPhaseKey,
      updatedById: adminUserId,
    },
    create: {
      competitionId,
      phaseMode,
      manualPhaseKey,
      updatedById: adminUserId,
    },
  });
}

export async function resolveJokerPhase(competitionId, fixture, config = null) {
  const jokerConfig = config || await getJokerConfig(competitionId);
  const apiPhaseKey = normalizePhase(fixture?.league?.round);
  const manualPhaseKey = jokerConfig.manualPhaseKey;

  if (
    jokerConfig.phaseMode === JOKER_PHASE_MODE.FORCE_MANUAL &&
    manualPhaseKey
  ) {
    return {
      phaseKey: manualPhaseKey,
      apiPhaseKey,
      source: 'manual_forced',
      label: getPhaseLabel(manualPhaseKey),
    };
  }

  if (apiPhaseKey) {
    return {
      phaseKey: apiPhaseKey,
      apiPhaseKey,
      source: 'api',
      label: getPhaseLabel(apiPhaseKey),
    };
  }

  if (manualPhaseKey) {
    return {
      phaseKey: manualPhaseKey,
      apiPhaseKey,
      source: 'manual_fallback',
      label: getPhaseLabel(manualPhaseKey),
    };
  }

  return {
    phaseKey: null,
    apiPhaseKey,
    source: 'unknown',
    label: null,
  };
}

export async function createJokerGrant(adminUserId, data) {
  const competitionId = Number(data.competitionId);
  const phaseKey = data.phaseKey;
  const amount = Number(data.amount);
  const message = String(data.message || '').trim() || null;

  if (!competitionId) throw new BadRequestError('competitionId es requerido');
  assertValidPhaseKey(phaseKey);
  if (!Number.isInteger(amount) || amount < 1 || amount > 20) {
    throw new BadRequestError('La cantidad de x2 debe ser un entero entre 1 y 20');
  }

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) throw new NotFoundError('Competicion no encontrada');

  return prisma.prodeJokerGrant.create({
    data: {
      competitionId,
      phaseKey,
      amount,
      message,
      releasedById: adminUserId,
    },
  });
}

export async function setJokerGrantActive(grantId, isActive) {
  const grant = await prisma.prodeJokerGrant.findUnique({
    where: { id: Number(grantId) },
  });
  if (!grant) throw new NotFoundError('Tanda x2 no encontrada');

  return prisma.prodeJokerGrant.update({
    where: { id: Number(grantId) },
    data: { isActive: Boolean(isActive) },
  });
}

async function getActivePhaseGrants(competitionId, phaseKey) {
  if (!phaseKey) return [];
  return prisma.prodeJokerGrant.findMany({
    where: {
      competitionId: Number(competitionId),
      phaseKey,
      isActive: true,
    },
    orderBy: { releasedAt: 'desc' },
  });
}

function sumGrantAmount(grants) {
  return grants.reduce((total, grant) => total + grant.amount, 0);
}

async function countPhaseJokers(userId, competitionId, phaseKey, excludeFixtureId = null) {
  const where = {
    userId,
    competitionId: Number(competitionId),
    isJoker: true,
    jokerPhaseKey: phaseKey,
  };
  if (excludeFixtureId) where.NOT = { externalFixtureId: String(excludeFixtureId) };
  return prisma.prediction.count({ where });
}

async function countLegacyJokers(userId, competitionId, excludeFixtureId = null) {
  const where = {
    userId,
    competitionId: Number(competitionId),
    isJoker: true,
  };
  if (excludeFixtureId) where.NOT = { externalFixtureId: String(excludeFixtureId) };
  return prisma.prediction.count({ where });
}

export async function getJokerAllowanceForPrediction(
  userId,
  competitionId,
  externalFixtureId,
  fixture,
) {
  const phase = await resolveJokerPhase(competitionId, fixture);
  const activeGrants = await getActivePhaseGrants(competitionId, phase.phaseKey);

  if (phase.phaseKey && activeGrants.length > 0) {
    const limit = sumGrantAmount(activeGrants);
    const used = await countPhaseJokers(
      userId,
      competitionId,
      phase.phaseKey,
      externalFixtureId,
    );
    return {
      mode: 'phase_grant',
      phase,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      grantId: activeGrants[0].id,
    };
  }

  const used = await countLegacyJokers(
    userId,
    competitionId,
    externalFixtureId,
  );
  return {
    mode: 'legacy',
    phase,
    limit: LEGACY_JOKER_LIMIT,
    used,
    remaining: Math.max(0, LEGACY_JOKER_LIMIT - used),
    grantId: null,
  };
}

export async function assertCanUseJoker(userId, competitionId, externalFixtureId, fixture) {
  const allowance = await getJokerAllowanceForPrediction(
    userId,
    competitionId,
    externalFixtureId,
    fixture,
  );

  if (allowance.used >= allowance.limit) {
    if (allowance.mode === 'phase_grant') {
      throw new BadRequestError(
        `Ya usaste los ${allowance.limit} comodines x2 de ${allowance.phase.label}`,
      );
    }
    throw new BadRequestError('Ya usaste los 3 comodines x2 de esta competencia');
  }

  return allowance;
}

export async function getUserJokerStatus(userId, competitionId) {
  const numericCompetitionId = Number(competitionId);
  const competition = await prisma.competition.findUnique({
    where: { id: numericCompetitionId },
    select: { id: true, name: true, logo: true },
  });
  if (!competition) throw new NotFoundError('Competicion no encontrada');

  const [config, grants, legacyUsed, seenRows] = await Promise.all([
    getJokerConfig(numericCompetitionId),
    prisma.prodeJokerGrant.findMany({
      where: { competitionId: numericCompetitionId },
      orderBy: { releasedAt: 'desc' },
    }),
    countLegacyJokers(userId, numericCompetitionId),
    prisma.prodeJokerGrantSeen.findMany({
      where: { userId },
      select: { grantId: true },
    }),
  ]);

  const activeGrants = grants.filter((grant) => grant.isActive);
  const phaseStatuses = {};

  for (const phase of JOKER_PHASES) {
    const phaseGrants = activeGrants.filter((grant) => grant.phaseKey === phase.key);
    const limit = sumGrantAmount(phaseGrants);
    const used = limit > 0
      ? await countPhaseJokers(userId, numericCompetitionId, phase.key)
      : 0;
    phaseStatuses[phase.key] = {
      phaseKey: phase.key,
      label: phase.label,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      hasGrant: limit > 0,
    };
  }

  const seenGrantIds = new Set(seenRows.map((row) => row.grantId));
  const unseenGrants = activeGrants
    .filter((grant) => !seenGrantIds.has(grant.id))
    .map((grant) => ({
      ...grant,
      label: getPhaseLabel(grant.phaseKey),
    }));

  return {
    competition,
    config,
    phases: JOKER_PHASES,
    grants: grants.map((grant) => ({
      ...grant,
      label: getPhaseLabel(grant.phaseKey),
    })),
    phaseStatuses,
    unseenGrants,
    legacy: {
      limit: LEGACY_JOKER_LIMIT,
      used: legacyUsed,
      remaining: Math.max(0, LEGACY_JOKER_LIMIT - legacyUsed),
    },
  };
}

export async function getAdminJokerState(competitionId) {
  const numericCompetitionId = Number(competitionId);
  const competition = await prisma.competition.findUnique({
    where: { id: numericCompetitionId },
    select: { id: true, name: true, logo: true },
  });
  if (!competition) throw new NotFoundError('Competicion no encontrada');

  const [config, grants, totalUsers] = await Promise.all([
    getJokerConfig(numericCompetitionId),
    prisma.prodeJokerGrant.findMany({
      where: { competitionId: numericCompetitionId },
      orderBy: { releasedAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  const usageByPhase = {};
  for (const phase of JOKER_PHASES) {
    usageByPhase[phase.key] = await prisma.prediction.count({
      where: {
        competitionId: numericCompetitionId,
        isJoker: true,
        jokerPhaseKey: phase.key,
      },
    });
  }

  return {
    competition,
    config,
    phases: JOKER_PHASES,
    grants: grants.map((grant) => ({
      ...grant,
      label: getPhaseLabel(grant.phaseKey),
    })),
    totalUsers,
    usageByPhase,
    legacyLimit: LEGACY_JOKER_LIMIT,
  };
}

export async function markJokerGrantSeen(userId, grantId) {
  const grant = await prisma.prodeJokerGrant.findUnique({
    where: { id: Number(grantId) },
  });
  if (!grant || !grant.isActive) throw new NotFoundError('Tanda x2 no encontrada');

  return prisma.prodeJokerGrantSeen.upsert({
    where: { userId_grantId: { userId, grantId: grant.id } },
    update: { seenAt: new Date() },
    create: { userId, grantId: grant.id },
  });
}
