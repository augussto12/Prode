/**
 * ═══════════════════════════════════════════════════════════════
 * MOTOR DE PUNTUACIÓN FANTASY — PRODE SOBERANO
 * ═══════════════════════════════════════════════════════════════
 *
 * Traduce las estadísticas crudas de un partido (PlayerMatchStat)
 * a puntos de Fantasy con desglose por categoría.
 *
 * Reglas:
 *   MINUTOS:           1-59 → +1,  60+ → +2,  90 → +3
 *   GOLES:             FWD/MID → +10,  DEF → +15,  GK → +20
 *   ASISTENCIAS:       +5
 *   TIROS AL ARCO:     +1 c/u
 *   PARTICIPACIÓN GOL: +2 bonus si gol>0 Y asistencia>0 en mismo partido
 *   AMARILLA:          -2
 *   DOBLE AMARILLA:    -7  (se detecta como yellowCards>=2 Y redCards>=1)
 *   ROJA DIRECTA:      -5  (redCards>=1 sin doble amarilla)
 *   VALLA INVICTA:     GK → +10, DEF → +6  (requiere 60+ min jugados)
 *   ATAJADAS (GK):     +1 c/u,  bonus +1 extra cada 3
 *   PENAL ATAJADO:     +5 c/u  (cuando esté disponible en datos)
 *   GOLES EN CONTRA:   -3 c/u
 *   RATING >= 8.0:     +3
 *   RATING >= 7.0:     +1
 *   RATING <= 5.0:     -1
 *   RATING <= 4.0:     -2
 *
 *   CAPITÁN:     puntaje × 2
 *   VICECAPITÁN: puntaje × 1.5  (solo si el capitán no jugó)
 */

/**
 * Calcula los puntos de un jugador individual a partir de sus
 * stats del partido, ya almacenadas en PlayerMatchStat.
 *
 * @param {object} stat - Fila de PlayerMatchStat (de Prisma)
 * @param {string} position - Posición canónica: 'GK' | 'DEF' | 'MID' | 'FWD'
 * @param {boolean} isCleanSheet - true si el equipo del jugador no recibió goles
 * @returns {{ goals: number, assists: number, cards: number, cleanSheet: number,
 *             saves: number, minutes: number, ratingBonus: number, shotsOnTarget: number,
 *             total: number }}
 */
export function calculatePlayerPoints(stat, position, isCleanSheet = false) {
  const breakdown = {
    goals: 0,
    assists: 0,
    cards: 0,
    cleanSheet: 0,
    saves: 0,
    minutes: 0,
    ratingBonus: 0,
    total: 0,
  };

  const mins = stat.minutesPlayed ?? 0;

  // ── Si no pisó el césped, 0 en todo ──
  if (mins === 0) return breakdown;

  // ═══ MINUTOS JUGADOS ═══
  if (mins >= 90) {
    breakdown.minutes = 3;    // titular completo
  } else if (mins >= 60) {
    breakdown.minutes = 2;
  } else {
    breakdown.minutes = 1;    // jugó al menos 1 min
  }

  // ═══ GOLES ═══
  const goals = stat.goals ?? 0;
  const goalValue =
    position === 'GK'  ? 20 :
    position === 'DEF' ? 15 :
    10; // MID y FWD
  breakdown.goals = goals * goalValue;

  // ═══ ASISTENCIAS ═══
  const assists = stat.assists ?? 0;
  breakdown.assists = assists * 5;

  // ═══ PARTICIPACIÓN EN GOL (bonus) ═══
  // Si hizo al menos 1 gol Y al menos 1 asistencia en el mismo partido
  if (goals > 0 && assists > 0) {
    breakdown.goals += 2; // se suma al bucket "goals" como bonus
  }

  // ═══ TIROS AL ARCO (se acumula como bonus ofensivo en "goals") ═══
  const shotsOT = stat.shotsOnTarget ?? 0;
  breakdown.goals += shotsOT; // +1 pt por cada tiro al arco

  // ═══ TARJETAS ═══
  const yellows = stat.yellowCards ?? 0;
  const reds    = stat.redCards ?? 0;

  if (yellows >= 2 && reds >= 1) {
    // Doble amarilla → roja: penalización acumulada = -7
    breakdown.cards = -7;
  } else if (reds >= 1) {
    // Roja directa
    breakdown.cards = -5;
  } else if (yellows >= 1) {
    // Una amarilla
    breakdown.cards = -2;
  }

  // ═══ VALLA INVICTA ═══
  // Solo si el jugador jugó 60+ minutos y su equipo no recibió goles
  if (isCleanSheet && mins >= 60) {
    if (position === 'GK')       breakdown.cleanSheet = 10;
    else if (position === 'DEF') breakdown.cleanSheet = 6;
  }

  // ═══ ATAJADAS (solo GK) ═══
  if (position === 'GK') {
    const savesCount = stat.saves ?? 0;
    breakdown.saves = savesCount;                          // +1 por atajada
    breakdown.saves += Math.floor(savesCount / 3);         // bonus cada 3
    // Penal atajado: +5 c/u  (penaltySaves no se recopila aún → 0)
    // breakdown.saves += (stat.penaltySaves ?? 0) * 5;
  }

  // ═══ GOLES EN CONTRA ═══
  const ownGoals = stat.ownGoals ?? 0;
  if (ownGoals > 0) {
    breakdown.goals -= ownGoals * 3;
  }

  // ═══ RATING SPORTMONKS ═══
  const rating = stat.rating;
  if (rating != null) {
    if (rating >= 8.0)      breakdown.ratingBonus = 3;
    else if (rating >= 7.0) breakdown.ratingBonus = 1;
    else if (rating <= 4.0) breakdown.ratingBonus = -2;
    else if (rating <= 5.0) breakdown.ratingBonus = -1;
  }

  // ═══ TOTAL ═══
  breakdown.total =
    breakdown.goals +
    breakdown.assists +
    breakdown.cards +
    breakdown.cleanSheet +
    breakdown.saves +
    breakdown.minutes +
    breakdown.ratingBonus;

  return breakdown;
}

/**
 * Aplica multiplicador de Capitán / Vicecapitán.
 *
 * Reglas:
 *   - Capitán: puntos × 2
 *   - Vicecapitán: puntos × 1.5  (solo si el capitán NO jugó)
 *
 * La lógica de delegación (si el capitán no jugó) se resuelve
 * en la capa superior (recalculateFixture), no aquí.
 *
 * @param {number} points - Puntos base del jugador
 * @param {boolean} isCaptain
 * @param {boolean} isViceCaptain
 * @returns {number}
 */
export function applyMultipliers(points, isCaptain, isViceCaptain) {
  if (isCaptain) return Math.round(points * 2);
  if (isViceCaptain) return Math.round(points * 1.5);
  return points;
}
