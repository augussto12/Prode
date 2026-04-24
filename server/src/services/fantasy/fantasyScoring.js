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
 * v2 — Scoring expandido:
 *   - Sin puntos por minutos (eliminado)
 *   - Sin vicecapitán (eliminado)
 *   - Tackles, interceptions, clearances, key passes, dribbles,
 *     duels, crosses, fouls, pass accuracy, own goals, penalty miss
 *
 * @param {object} stat - Fila de PlayerMatchStat (de Prisma)
 * @param {string} position - Posición canónica: 'GK' | 'DEF' | 'MID' | 'FWD'
 * @param {boolean} isCleanSheet - true si el equipo del jugador no recibió goles
 * @returns {object} breakdown con total
 */
export function calculatePlayerPoints(stat, position, isCleanSheet = false) {
  const breakdown = {
    goals: 0,
    assists: 0,
    cards: 0,
    cleanSheet: 0,
    saves: 0,
    ratingBonus: 0,
    defensive: 0,
    offensive: 0,
    discipline: 0,
    total: 0,
  };

  const mins = stat.minutesPlayed ?? 0;

  // ── Si no pisó el césped, 0 en todo ──
  if (mins === 0) return breakdown;

  // ═══ GOLES ═══
  const goals = stat.goals ?? 0;
  const goalValue =
    position === 'GK' ? 20 :
      position === 'DEF' ? 15 :
        10; // MID y FWD
  breakdown.goals = goals * goalValue;

  // ═══ HAT-TRICK BONUS ═══
  if (goals >= 3) {
    breakdown.goals += 5;
  }

  // ═══ ASISTENCIAS ═══
  const assists = stat.assists ?? 0;
  breakdown.assists = assists * 5;

  // ═══ PARTICIPACIÓN EN GOL (bonus) ═══
  if (goals > 0 && assists > 0) {
    breakdown.goals += 2;
  }

  // ═══ TIROS AL ARCO ═══
  const shotsOT = stat.shotsOnTarget ?? 0;
  breakdown.offensive += shotsOT; // +1 pt por cada tiro al arco

  // ═══ KEY PASSES (todas las posiciones) ═══
  const keyPasses = stat.keyPasses ?? 0;
  breakdown.offensive += keyPasses; // +1 c/u

  // ═══ TARJETAS ═══
  const yellows = stat.yellowCards ?? 0;
  const reds = stat.redCards ?? 0;

  if (yellows >= 2 && reds >= 1) {
    breakdown.cards = -7;  // Doble amarilla → roja
  } else if (reds >= 1) {
    breakdown.cards = -5;  // Roja directa
  } else if (yellows >= 1) {
    breakdown.cards = -2;  // Una amarilla
  }

  // ═══ AUTOGOLES (detectado desde events) ═══
  const ownGoals = stat.ownGoals ?? 0;
  if (ownGoals > 0) {
    breakdown.discipline -= ownGoals * 3;
  }

  // ═══ PENAL FALLADO (detectado desde events) ═══
  const penMissed = stat.penaltyMissed ?? 0;
  if (penMissed > 0) {
    breakdown.discipline -= penMissed * 3;
  }

  // ═══ VALLA INVICTA ═══
  if (isCleanSheet && mins >= 60) {
    if (position === 'GK') breakdown.cleanSheet = 10;
    else if (position === 'DEF') breakdown.cleanSheet = 6;
  }

  // ═══ ATAJADAS (solo GK) ═══
  if (position === 'GK') {
    const savesCount = stat.saves ?? 0;
    breakdown.saves = savesCount;                      // +1 por atajada
    breakdown.saves += Math.floor(savesCount / 3);     // bonus cada 3
  }

  // ═══ TACKLES (todas las posiciones, +0.5 c/u) ═══
  const tackles = stat.tackles ?? 0;
  breakdown.defensive += tackles * 0.5;

  // ═══ INTERCEPTIONS (todas las posiciones, +0.5 c/u) ═══
  const interceptions = stat.interceptions ?? 0;
  breakdown.defensive += interceptions * 0.5;

  // ═══ CLEARANCES (todas las posiciones, +0.5 c/u) ═══
  const clearances = stat.clearances ?? 0;
  breakdown.defensive += clearances * 0.5;

  // ═══ DRIBBLES EXITOSOS (todas las posiciones, +0.5 c/u) ═══
  const dribbles = stat.dribblesWon ?? 0;
  breakdown.offensive += dribbles * 0.5;

  // ═══ DUELS WON (todas las posiciones, +0.5 c/u) ═══
  const duelsWon = stat.duelsWon ?? 0;
  breakdown.defensive += duelsWon * 0.5;

  // ═══ ACCURATE CROSSES (todas las posiciones, +0.5 c/u) ═══
  const accCrosses = stat.accurateCrosses ?? 0;
  breakdown.offensive += accCrosses * 0.5;

  // ═══ FOULS DRAWN (todas las posiciones, +0.5 c/u) ═══
  const foulsDrawn = stat.foulsDrawn ?? 0;
  breakdown.discipline += foulsDrawn * 0.5;

  // ═══ FOULS COMMITTED (todas las posiciones, -0.5 c/u) ═══
  const foulsComm = stat.foulsCommitted ?? 0;
  breakdown.discipline -= foulsComm * 0.5;

  // ═══ PASS ACCURACY BONUS (≥85% y mínimo 30 pases) ═══
  const passesAttempted = stat.passesAttempted ?? 0;
  const passesCompleted = stat.passesCompleted ?? 0;
  if (passesAttempted >= 30) {
    const passAcc = (passesCompleted / passesAttempted) * 100;
    if (passAcc >= 85) {
      breakdown.offensive += 2;
    }
  }

  // ═══ RATING SPORTMONKS ═══
  const rating = stat.rating;
  if (rating != null) {
    if (rating >= 8.0) breakdown.ratingBonus = 3;
    else if (rating >= 7.0) breakdown.ratingBonus = 1;
    else if (rating <= 4.0) breakdown.ratingBonus = -2;
    else if (rating <= 5.0) breakdown.ratingBonus = -1;
  }

  // ═══ REDONDEAR decimales (0.5s) ═══
  breakdown.defensive = Math.round(breakdown.defensive);
  breakdown.offensive = Math.round(breakdown.offensive);
  breakdown.discipline = Math.round(breakdown.discipline);

  // ═══ TOTAL ═══
  breakdown.total =
    breakdown.goals +
    breakdown.assists +
    breakdown.cards +
    breakdown.cleanSheet +
    breakdown.saves +
    breakdown.ratingBonus +
    breakdown.defensive +
    breakdown.offensive +
    breakdown.discipline;

  return breakdown;
}
/**
 * Aplica multiplicador de Capitán.
 *
 * Reglas:
 *   - Capitán: puntos × 2
 *   - Vice-capitán ELIMINADO
 *
 * @param {number} points - Puntos base del jugador
 * @param {boolean} isCaptain
 * @returns {number}
 */
export function applyMultipliers(points, isCaptain) {
  if (isCaptain) return Math.round(points * 2);
  return points;
}
