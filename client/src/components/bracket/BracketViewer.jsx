import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { m } from 'framer-motion';
import { ArrowRight, GitBranch, List, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MatchCard from './MatchCard';
import MatchDetailPanel from './MatchDetailPanel';
import { tRound } from '../../utils/translations';

// ─── Desktop layout constants ───
const CARD_W = 160;
const CARD_H = 88;
const MIN_COL_GAP = 24;
const ROW_GAP = 20;
const PADDING_X = 12;
const PADDING_TOP = 34;
const PADDING_BOTTOM = 16;
const MOBILE_BREAKPOINT = 768;

// ─── Mobile vertical layout constants ───
const M_CARD_H = 58;
const M_ROUND_GAP = 44;
const M_HEADER_H = 24;
const M_PAD = 8;
const M_CARD_GAP = 8;

// ────────────────────────────────────────
// REGULAR LAYOUT (left → right)
// ────────────────────────────────────────
function computeLayout(columns, containerWidth = 0) {
  if (!columns?.length) return { nodes: [], connectors: [], width: 0, height: 0, phaseHeaders: [] };
  const nodes = [], connectors = [];
  const N = columns.length;
  const minW = PADDING_X * 2 + N * CARD_W + (N - 1) * MIN_COL_GAP;
  const effW = Math.max(containerWidth, minW);
  const gap = N > 1 ? Math.max(MIN_COL_GAP, (effW - PADDING_X * 2 - N * CARD_W) / (N - 1)) : 0;
  const cx = (ci) => PADDING_X + ci * (CARD_W + gap);
  const pos = [];
  pos[0] = columns[0].matchups.map((_, mi) => ({ x: cx(0), y: PADDING_TOP + mi * (CARD_H + ROW_GAP) }));
  for (let ci = 1; ci < N; ci++) {
    const prev = columns[ci - 1];
    pos[ci] = columns[ci].matchups.map((m, mi) => {
      const ff = prev.matchups.map((pm, pmi) => pm._nextMatchIndex === mi ? pmi : -1).filter(i => i >= 0);
      let y;
      if (ff.length >= 2 && pos[ci - 1][ff[0]] && pos[ci - 1][ff[1]]) y = (pos[ci - 1][ff[0]].y + pos[ci - 1][ff[1]].y) / 2;
      else if (ff.length === 1 && pos[ci - 1][ff[0]]) y = pos[ci - 1][ff[0]].y;
      else y = PADDING_TOP + mi * (CARD_H + ROW_GAP * Math.pow(2, ci));
      return { x: cx(ci), y };
    });
  }
  columns.forEach((col, ci) => col.matchups.forEach((m, mi) => nodes.push({ matchup: m, x: pos[ci][mi].x, y: pos[ci][mi].y })));
  for (let ci = 0; ci < N - 1; ci++) {
    columns[ci].matchups.forEach((m, mi) => {
      const nmi = m._nextMatchIndex;
      if (nmi == null || nmi < 0 || !pos[ci + 1]?.[nmi]) return;
      const f = pos[ci][mi], t = pos[ci + 1][nmi];
      connectors.push({ path: `M ${f.x + CARD_W} ${f.y + CARD_H / 2} H ${(f.x + CARD_W + t.x) / 2} V ${t.y + CARD_H / 2} H ${t.x}`, isWinnerPath: m.isFinished && m.winnerId != null });
    });
  }
  const allY = pos.flat().map(p => p.y);
  return { nodes, connectors, width: effW, height: Math.max(...allY, 0) + CARD_H + PADDING_BOTTOM, phaseHeaders: columns.map((c, ci) => ({ label: tRound(c.phase), x: cx(ci) })) };
}

// ────────────────────────────────────────
// MIRRORED LAYOUT (desktop side-by-side)
// ────────────────────────────────────────
function computeMirroredLayout(columns, containerWidth = 0) {
  if (!columns?.length) return { nodes: [], connectors: [], width: 0, height: 0, phaseHeaders: [] };
  const N = columns.length;
  const last = columns[N - 1];
  const hasFinal = last.matchups.length === 1 && N > 1;
  const rounds = hasFinal ? columns.slice(0, -1) : columns;
  const finalM = hasFinal ? last.matchups[0] : null;
  const NR = rounds.length;
  if (NR <= 1) return computeLayout(columns, containerWidth);
  const TV = hasFinal ? 2 * NR + 1 : 2 * NR;
  const minW = PADDING_X * 2 + TV * CARD_W + (TV - 1) * MIN_COL_GAP;
  const effW = Math.max(containerWidth, minW);
  const gap = TV > 1 ? Math.max(MIN_COL_GAP, (effW - PADDING_X * 2 - TV * CARD_W) / (TV - 1)) : 0;
  const cx = (vc) => PADDING_X + vc * (CARD_W + gap);
  const lvc = (ri) => ri, fvc = NR, rvc = (ri) => 2 * NR - ri;
  const half = (a) => Math.ceil(a.length / 2);
  const LM = rounds.map(c => c.matchups.slice(0, half(c.matchups)));
  const RM = rounds.map(c => c.matchups.slice(half(c.matchups)));
  const rnl = rounds.map((col, ri) => {
    if (ri >= NR - 1) return RM[ri].map(() => -1);
    const nh = half(rounds[ri + 1].matchups);
    return RM[ri].map(m => { if (m._nextMatchIndex == null || m._nextMatchIndex < 0) return -1; return m._nextMatchIndex - nh >= 0 ? m._nextMatchIndex - nh : -1; });
  });
  const nodes = [], connectors = [];
  const LP = [], RP = [];
  const leftCount = LM[0].length, maxFirst = Math.max(leftCount, RM[0].length);
  const totalH = maxFirst * (CARD_H + ROW_GAP) - ROW_GAP;
  const leftTotalH = leftCount * (CARD_H + ROW_GAP) - ROW_GAP;
  const leftOffY = PADDING_TOP + (totalH - leftTotalH) / 2;
  LP[0] = LM[0].map((_, mi) => ({ x: cx(lvc(0)), y: leftOffY + mi * (CARD_H + ROW_GAP) }));
  for (let ri = 1; ri < NR; ri++) {
    LP[ri] = LM[ri].map((m, mi) => {
      const ff = LM[ri - 1].map((pm, pmi) => pm._nextMatchIndex === mi ? pmi : -1).filter(i => i >= 0);
      let y;
      if (ff.length >= 2 && LP[ri - 1][ff[0]] && LP[ri - 1][ff[1]]) y = (LP[ri - 1][ff[0]].y + LP[ri - 1][ff[1]].y) / 2;
      else if (ff.length === 1 && LP[ri - 1][ff[0]]) y = LP[ri - 1][ff[0]].y;
      else y = leftOffY + mi * (CARD_H + ROW_GAP * Math.pow(2, ri));
      return { x: cx(lvc(ri)), y };
    });
  }
  for (let ri = 0; ri < NR; ri++) LM[ri].forEach((m, mi) => nodes.push({ matchup: m, x: LP[ri][mi].x, y: LP[ri][mi].y }));
  for (let ri = 0; ri < NR - 1; ri++) {
    LM[ri].forEach((m, mi) => {
      if (m._nextMatchIndex == null || m._nextMatchIndex < 0 || !LP[ri + 1]?.[m._nextMatchIndex]) return;
      const f = LP[ri][mi], t = LP[ri + 1][m._nextMatchIndex];
      connectors.push({ path: `M ${f.x + CARD_W} ${f.y + CARD_H / 2} H ${(f.x + CARD_W + t.x) / 2} V ${t.y + CARD_H / 2} H ${t.x}`, isWinnerPath: m.isFinished && m.winnerId != null });
    });
  }
  const rightCount = RM[0].length, rightTotalH = rightCount * (CARD_H + ROW_GAP) - ROW_GAP;
  const rightOffY = PADDING_TOP + (totalH - rightTotalH) / 2;
  RP[0] = RM[0].map((_, mi) => ({ x: cx(rvc(0)), y: rightOffY + mi * (CARD_H + ROW_GAP) }));
  for (let ri = 1; ri < NR; ri++) {
    RP[ri] = RM[ri].map((m, mi) => {
      const ff = rnl[ri - 1].map((nxt, pmi) => nxt === mi ? pmi : -1).filter(i => i >= 0);
      let y;
      if (ff.length >= 2 && RP[ri - 1][ff[0]] && RP[ri - 1][ff[1]]) y = (RP[ri - 1][ff[0]].y + RP[ri - 1][ff[1]].y) / 2;
      else if (ff.length === 1 && RP[ri - 1][ff[0]]) y = RP[ri - 1][ff[0]].y;
      else y = rightOffY + mi * (CARD_H + ROW_GAP * Math.pow(2, ri));
      return { x: cx(rvc(ri)), y };
    });
  }
  for (let ri = 0; ri < NR; ri++) RM[ri].forEach((m, mi) => nodes.push({ matchup: m, x: RP[ri][mi].x, y: RP[ri][mi].y }));
  for (let ri = 0; ri < NR - 1; ri++) {
    RM[ri].forEach((m, mi) => {
      const toMi = rnl[ri][mi];
      if (toMi < 0 || !RP[ri + 1]?.[toMi]) return;
      const f = RP[ri][mi], t = RP[ri + 1][toMi];
      connectors.push({ path: `M ${f.x} ${f.y + CARD_H / 2} H ${(f.x + t.x + CARD_W) / 2} V ${t.y + CARD_H / 2} H ${t.x + CARD_W}`, isWinnerPath: m.isFinished && m.winnerId != null });
    });
  }
  if (finalM && LP[NR - 1]?.[0] && RP[NR - 1]?.[0]) {
    const ls = LP[NR - 1][0], rs = RP[NR - 1][0];
    const fx = cx(fvc), fy = (ls.y + rs.y) / 2;
    nodes.push({ matchup: finalM, x: fx, y: fy });
    const fy2 = fy + CARD_H / 2;
    connectors.push({ path: `M ${ls.x + CARD_W} ${ls.y + CARD_H / 2} H ${(ls.x + CARD_W + fx) / 2} V ${fy2} H ${fx}`, isWinnerPath: LM[NR - 1][0]?.isFinished && LM[NR - 1][0]?.winnerId != null });
    connectors.push({ path: `M ${rs.x} ${rs.y + CARD_H / 2} H ${(rs.x + fx + CARD_W) / 2} V ${fy2} H ${fx + CARD_W}`, isWinnerPath: RM[NR - 1][0]?.isFinished && RM[NR - 1][0]?.winnerId != null });
  }
  const allY = nodes.map(n => n.y);
  const ph = [];
  for (let ri = 0; ri < NR; ri++) ph.push({ label: tRound(rounds[ri].phase), x: cx(lvc(ri)) });
  if (hasFinal) ph.push({ label: 'Final', x: cx(fvc) });
  for (let ri = 0; ri < NR; ri++) ph.push({ label: tRound(rounds[ri].phase), x: cx(rvc(ri)) });
  return { nodes, connectors, width: effW, height: Math.max(...allY, 0) + CARD_H + PADDING_BOTTOM, phaseHeaders: ph };
}

// ────────────────────────────────────────
// VERTICAL MIRRORED LAYOUT (mobile enfrentados)
// Top bracket → FINAL → Bottom bracket (inverted)
// ────────────────────────────────────────
function computeVerticalLayout(columns, containerWidth) {
  if (!columns?.length || containerWidth <= 0) return { nodes: [], connectors: [], width: 0, height: 0, phaseHeaders: [] };

  const N = columns.length;
  const last = columns[N - 1];
  const hasFinal = last.matchups.length === 1 && N > 1;
  const rounds = hasFinal ? columns.slice(0, -1) : columns;
  const finalM = hasFinal ? last.matchups[0] : null;
  const NR = rounds.length;

  // If not enough rounds to split, use simple top-down
  if (NR <= 1) return computeSimpleVerticalLayout(columns, containerWidth);

  const half = (a) => Math.ceil(a.length / 2);
  const LM = rounds.map(c => c.matchups.slice(0, half(c.matchups)));
  const RM = rounds.map(c => c.matchups.slice(half(c.matchups)));

  // Remap right-half _nextMatchIndex to local indices
  const rnl = rounds.map((col, ri) => {
    if (ri >= NR - 1) return RM[ri].map(() => -1);
    const nh = half(rounds[ri + 1].matchups);
    return RM[ri].map(m => {
      if (m._nextMatchIndex == null || m._nextMatchIndex < 0) return -1;
      return m._nextMatchIndex - nh >= 0 ? m._nextMatchIndex - nh : -1;
    });
  });

  const maxCards = Math.max(...rounds.map(c => Math.ceil(c.matchups.length / 2)));
  const cardW = Math.min(
    Math.floor((containerWidth - M_PAD * 2 - Math.max(0, maxCards - 1) * M_CARD_GAP) / Math.max(maxCards, 1)),
    170
  );

  const nodes = [], connectors = [], phaseHeaders = [];
  let currentY = M_PAD;

  // Helper: lay out a set of rounds top-down, return positions
  function layoutHalf(halfMatchups, halfLabel, roundPhases, nextIndexFn) {
    const halfPositions = [];

    for (let ri = 0; ri < halfMatchups.length; ri++) {
      const matchups = halfMatchups[ri];
      const count = matchups.length;
      const rowW = count * cardW + (count - 1) * M_CARD_GAP;
      const startX = (containerWidth - rowW) / 2;

      // Phase header
      phaseHeaders.push({ label: tRound(roundPhases[ri]), y: currentY, count });
      currentY += M_HEADER_H;

      const roundPos = [];
      matchups.forEach((m, mi) => {
        const x = startX + mi * (cardW + M_CARD_GAP);
        roundPos.push({ x, y: currentY });
        nodes.push({ matchup: m, x, y: currentY, w: cardW });
      });
      halfPositions.push(roundPos);
      currentY += M_CARD_H;

      // Connectors to next round in this half (grouped bracket lines)
      if (ri < halfMatchups.length - 1) {
        const nextMatchups = halfMatchups[ri + 1];
        const nextCount = nextMatchups.length;
        const nextRowW = nextCount * cardW + (nextCount - 1) * M_CARD_GAP;
        const nextStartX = (containerWidth - nextRowW) / 2;
        const nextCardY = currentY + M_ROUND_GAP + M_HEADER_H;
        const midY = currentY + M_ROUND_GAP / 2;

        // Group parents by their target child
        const groups = {};
        matchups.forEach((m, mi) => {
          const nmi = nextIndexFn(ri, mi);
          if (nmi == null || nmi < 0) return;
          if (!groups[nmi]) groups[nmi] = [];
          groups[nmi].push({ mi, m });
        });

        Object.entries(groups).forEach(([nmiStr, parents]) => {
          const nmi = Number(nmiStr);
          const toX = nextStartX + nmi * (cardW + M_CARD_GAP) + cardW / 2;
          const toY = nextCardY;
          const anyWinner = parents.some(p => p.m.isFinished && p.m.winnerId != null);

          // Vertical lines from each parent down to midY
          parents.forEach(({ mi }) => {
            const fromX = roundPos[mi].x + cardW / 2;
            connectors.push({ path: `M ${fromX} ${currentY} V ${midY}`, isWinnerPath: anyWinner });
          });
          // Horizontal bar connecting all parents at midY
          if (parents.length >= 2) {
            const xs = parents.map(p => roundPos[p.mi].x + cardW / 2).sort((a, b) => a - b);
            connectors.push({ path: `M ${xs[0]} ${midY} H ${xs[xs.length - 1]}`, isWinnerPath: anyWinner });
          }
          // Single vertical line from center of bar down to child
          const centerX = parents.length >= 2
            ? (Math.min(...parents.map(p => roundPos[p.mi].x + cardW / 2)) + Math.max(...parents.map(p => roundPos[p.mi].x + cardW / 2))) / 2
            : roundPos[parents[0].mi].x + cardW / 2;
          // Horizontal from center to child X, then vertical down
          connectors.push({ path: `M ${centerX} ${midY} H ${toX} V ${toY}`, isWinnerPath: anyWinner });
        });

        currentY += M_ROUND_GAP;
      }
    }

    return halfPositions;
  }

  // ─── TOP HALF (left bracket, converging down) ───
  const leftPositions = layoutHalf(
    LM,
    'left',
    rounds.map(c => c.phase),
    (ri, mi) => LM[ri][mi]?._nextMatchIndex
  );

  // Connector from last left-half to Final
  const lastLeftPos = leftPositions[NR - 1]?.[0];

  // ─── FINAL ───
  currentY += M_ROUND_GAP / 2;
  if (finalM) {
    const finalW = Math.min(cardW * 1.2, 190);
    const finalX = (containerWidth - finalW) / 2;
    phaseHeaders.push({ label: '⭐ FINAL', y: currentY, count: 1, isFinal: true });
    currentY += M_HEADER_H;
    const finalY = currentY;
    nodes.push({ matchup: finalM, x: finalX, y: finalY, w: finalW, isFinal: true });

    // Connect last left SF → Final
    if (lastLeftPos) {
      const fromX = lastLeftPos.x + cardW / 2;
      const fromY = lastLeftPos.y + M_CARD_H;
      const toX = finalX + finalW / 2;
      const toY = finalY;
      const midY = (fromY + toY) / 2;
      connectors.push({ path: `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`, isWinnerPath: LM[NR - 1][0]?.isFinished && LM[NR - 1][0]?.winnerId != null });
    }

    currentY += M_CARD_H;

    // Connect Final → first right SF
    const firstRightSF = RM[NR - 1]?.[0];
    if (firstRightSF) {
      const rightSFCount = RM[NR - 1].length;
      const rightSFRowW = rightSFCount * cardW + (rightSFCount - 1) * M_CARD_GAP;
      const rightSFStartX = (containerWidth - rightSFRowW) / 2;
      const fromX = finalX + finalW / 2;
      const fromY = currentY;
      const toX = rightSFStartX + cardW / 2;
      const toY = currentY + M_ROUND_GAP / 2 + M_HEADER_H;
      const midY = (fromY + toY) / 2;
      connectors.push({ path: `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`, isWinnerPath: RM[NR - 1][0]?.isFinished && RM[NR - 1][0]?.winnerId != null });
    }

    currentY += M_ROUND_GAP / 2;
  }

  // ─── BOTTOM HALF (right bracket, diverging down from Final) ───
  // Render rounds in REVERSE order: SF → QF → R16
  const reversedRM = [...RM].reverse();
  const reversedPhases = [...rounds].reverse().map(c => c.phase);
  const reversedRnl = [...rnl].reverse();

  const bottomPositions = [];
  for (let ri = 0; ri < reversedRM.length; ri++) {
    const matchups = reversedRM[ri];
    const count = matchups.length;
    const rowW = count * cardW + (count - 1) * M_CARD_GAP;
    const startX = (containerWidth - rowW) / 2;

    phaseHeaders.push({ label: tRound(reversedPhases[ri]), y: currentY, count });
    currentY += M_HEADER_H;

    const roundPos = [];
    matchups.forEach((m, mi) => {
      const x = startX + mi * (cardW + M_CARD_GAP);
      roundPos.push({ x, y: currentY });
      nodes.push({ matchup: m, x, y: currentY, w: cardW });
    });
    bottomPositions.push(roundPos);
    currentY += M_CARD_H;

    // Connectors from this round to the NEXT round below (diverging, grouped)
    if (ri < reversedRM.length - 1) {
      const nextMatchups = reversedRM[ri + 1];
      const nextCount = nextMatchups.length;
      const nextRowW = nextCount * cardW + (nextCount - 1) * M_CARD_GAP;
      const nextStartX = (containerWidth - nextRowW) / 2;
      const nextCardY = currentY + M_ROUND_GAP + M_HEADER_H;
      const midY = currentY + M_ROUND_GAP / 2;

      const origRi = reversedRM.length - 1 - (ri + 1);
      const origRnl = rnl[origRi];

      if (origRnl) {
        // Group children by their parent in the current round
        const groups = {};
        nextMatchups.forEach((m, mi) => {
          const parentMi = origRnl[mi];
          if (parentMi == null || parentMi < 0 || !roundPos[parentMi]) return;
          if (!groups[parentMi]) groups[parentMi] = [];
          groups[parentMi].push({ mi, m });
        });

        Object.entries(groups).forEach(([parentMiStr, children]) => {
          const parentMi = Number(parentMiStr);
          const fromX = roundPos[parentMi].x + cardW / 2;
          const anyWinner = children.some(c => c.m.isFinished && c.m.winnerId != null);

          // Vertical line from parent down to midY
          connectors.push({ path: `M ${fromX} ${currentY} V ${midY}`, isWinnerPath: anyWinner });

          // Horizontal bar at midY spanning all children
          const childXs = children.map(c => nextStartX + c.mi * (cardW + M_CARD_GAP) + cardW / 2).sort((a, b) => a - b);
          if (childXs.length >= 2) {
            connectors.push({ path: `M ${childXs[0]} ${midY} H ${childXs[childXs.length - 1]}`, isWinnerPath: anyWinner });
          }

          // Horizontal from parent X to midpoint of children range, then vertical lines from bar to each child
          const childCenter = (childXs[0] + childXs[childXs.length - 1]) / 2;
          connectors.push({ path: `M ${fromX} ${midY} H ${childCenter}`, isWinnerPath: anyWinner });

          children.forEach(({ mi: cmi, m }) => {
            const toX = nextStartX + cmi * (cardW + M_CARD_GAP) + cardW / 2;
            connectors.push({ path: `M ${toX} ${midY} V ${nextCardY}`, isWinnerPath: m.isFinished && m.winnerId != null });
          });
        });
      }

      currentY += M_ROUND_GAP;
    }
  }

  return { nodes, connectors, phaseHeaders, width: containerWidth, height: currentY + M_PAD };
}

// Simple top-down (fallback for ≤1 round)
function computeSimpleVerticalLayout(columns, containerWidth) {
  if (!columns?.length || containerWidth <= 0) return { nodes: [], connectors: [], width: 0, height: 0, phaseHeaders: [] };
  const nodes = [], connectors = [], phaseHeaders = [];
  const maxCards = Math.max(...columns.map(c => c.matchups.length));
  const cardW = Math.min(Math.floor((containerWidth - M_PAD * 2 - Math.max(0, maxCards - 1) * M_CARD_GAP) / maxCards), 170);
  let currentY = M_PAD;

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    const count = col.matchups.length;
    const rowW = count * cardW + (count - 1) * M_CARD_GAP;
    const startX = (containerWidth - rowW) / 2;
    phaseHeaders.push({ label: tRound(col.phase), y: currentY, count });
    currentY += M_HEADER_H;
    const roundPos = [];
    col.matchups.forEach((m, mi) => {
      const x = startX + mi * (cardW + M_CARD_GAP);
      roundPos.push({ x, y: currentY });
      nodes.push({ matchup: m, x, y: currentY, w: cardW });
    });
    currentY += M_CARD_H;
    if (ci < columns.length - 1) {
      const nextCol = columns[ci + 1];
      const nextCount = nextCol.matchups.length;
      const nextRowW = nextCount * cardW + (nextCount - 1) * M_CARD_GAP;
      const nextStartX = (containerWidth - nextRowW) / 2;
      col.matchups.forEach((m, mi) => {
        const nmi = m._nextMatchIndex;
        if (nmi == null || nmi < 0) return;
        const fromX = roundPos[mi].x + cardW / 2;
        const toX = nextStartX + nmi * (cardW + M_CARD_GAP) + cardW / 2;
        const midY = currentY + M_ROUND_GAP / 2;
        connectors.push({ path: `M ${fromX} ${currentY} V ${midY} H ${toX} V ${currentY + M_ROUND_GAP + M_HEADER_H}`, isWinnerPath: m.isFinished && m.winnerId != null });
      });
      currentY += M_ROUND_GAP;
    }
  }
  return { nodes, connectors, phaseHeaders, width: containerWidth, height: currentY + M_PAD };
}

// ────────────────────────────────────────
// MOBILE MATCH CARD (compact vertical card)
// ────────────────────────────────────────
function MobileVerticalCard({ matchup, index, cardW, onSelect }) {
  const navigate = useNavigate();
  const { teamA, teamB, aggA, aggB, legs, winnerId, isFinished, isLive } = matchup;
  const isPlayed = isFinished || isLive;

  const matchDate = legs?.[0]?.fixture?.date;
  const liveMinute = isLive ? legs?.find(l => ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(l.fixture.status?.short))?.fixture?.status?.elapsed : null;

  const formatDate = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  };

  const getShortName = (team) => {
    if (team.id < 0) return '—';
    if (team.code) return team.code;
    const name = team.name || '';
    return name.length <= 3 ? name : name.substring(0, 3).toUpperCase();
  };

  const hasLogo = (team) => team.logo && team.id > 0;

  const Row = ({ team, goals, isWinner, isLoser }) => (
    <div className={`flex items-center gap-1 px-1.5 py-[3px] ${isWinner ? 'bg-emerald-500/[0.06]' : ''}`}>
      {hasLogo(team) ? (
        <img src={team.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
      ) : (
        <span className="w-3.5 h-3.5 shrink-0" />
      )}
      <span
        className={`flex-1 text-[10px] font-bold truncate cursor-default ${
          isWinner ? 'text-white' : isLoser ? 'text-slate-400' : 'text-white/80'
        }`}
      >{getShortName(team)}</span>
      <span className={`text-[10px] font-bold font-mono min-w-[10px] text-right shrink-0 ${
        isWinner ? 'text-emerald-300' : isLoser ? 'text-slate-500' : 'text-white/50'
      }`}>{isPlayed ? (goals ?? '-') : '-'}</span>
      {isWinner && <span className="text-emerald-400 text-[7px] shrink-0">✓</span>}
    </div>
  );

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      onClick={() => isPlayed && onSelect?.(matchup)}
      className={`bg-slate-900/90 border border-slate-700/70 rounded-md overflow-hidden transition-colors ${
        isPlayed ? 'cursor-pointer active:bg-slate-800/90' : 'cursor-default opacity-70'
      }`}
      style={{ width: cardW ? (typeof cardW === 'number' ? `${cardW}px` : cardW) : '100%' }}
    >
      <div className="flex items-center justify-between px-1.5 py-[1px] bg-slate-800/30">
        <span className="text-[7px] text-slate-500">{!isPlayed && !isFinished && formatDate(matchDate)}</span>
        <span className={`text-[7px] font-bold uppercase flex items-center gap-0.5 ${
          isLive ? 'text-red-500' : isFinished ? 'text-emerald-400' : 'text-slate-500'
        }`}>
          {isLive && <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse inline-block" />}
          {isLive && liveMinute ? `${liveMinute}'` : isFinished ? 'FIN' : '—'}
        </span>
      </div>
      <Row team={teamA} goals={aggA} isWinner={winnerId === teamA.id} isLoser={isFinished && winnerId && winnerId !== teamA.id} />
      <div className="h-px bg-slate-700/30 mx-1" />
      <Row team={teamB} goals={aggB} isWinner={winnerId === teamB.id} isLoser={isFinished && winnerId && winnerId !== teamB.id} />
    </m.div>
  );
}

function PlayoffsList({ matchups, onSelect, isMobile }) {
  if (!matchups?.length) return null;
  return (
    <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
      {matchups.map((m, i) => (
        isMobile
          ? <MobileVerticalCard key={m.id} matchup={m} index={i} cardW="100%" onSelect={onSelect} />
          : <MatchCard key={m.id} matchup={m} index={i} onSelect={onSelect} />
      ))}
    </div>
  );
}

function computeVerticalLayoutFixed(columns, containerWidth) {
  if (!columns?.length || containerWidth <= 0) return { nodes: [], connectors: [], width: 0, height: 0, phaseHeaders: [] };

  const N = columns.length;
  const last = columns[N - 1];
  const hasFinal = last.matchups.length === 1 && N > 1;
  const rounds = hasFinal ? columns.slice(0, -1) : columns;
  const finalM = hasFinal ? last.matchups[0] : null;
  const NR = rounds.length;

  if (NR <= 1) return computeSimpleVerticalLayout(columns, containerWidth);

  const half = (a) => Math.ceil(a.length / 2);
  const LM = rounds.map(c => c.matchups.slice(0, half(c.matchups)));
  const RM = rounds.map(c => c.matchups.slice(half(c.matchups)));

  const rnl = rounds.map((col, ri) => {
    if (ri >= NR - 1) return RM[ri].map(() => -1);
    const nh = half(rounds[ri + 1].matchups);
    return RM[ri].map(m => {
      if (m._nextMatchIndex == null || m._nextMatchIndex < 0) return -1;
      return m._nextMatchIndex - nh >= 0 ? m._nextMatchIndex - nh : -1;
    });
  });

  const maxCards = Math.max(...rounds.map(c => Math.ceil(c.matchups.length / 2)));
  const cardW = Math.min(
    Math.floor((containerWidth - M_PAD * 2 - Math.max(0, maxCards - 1) * M_CARD_GAP) / Math.max(maxCards, 1)),
    170
  );

  const LP_pos = [];
  const rowW_L = LM[0].length * cardW + (LM[0].length - 1) * M_CARD_GAP;
  const startX_L = (containerWidth - rowW_L) / 2;
  LP_pos[0] = LM[0].map((_, mi) => ({ x: startX_L + mi * (cardW + M_CARD_GAP) }));
  
  for (let ri = 1; ri < NR; ri++) {
    LP_pos[ri] = LM[ri].map((m, mi) => {
      const parentIndices = LM[ri - 1].map((pm, pmi) => pm._nextMatchIndex === mi ? pmi : -1).filter(i => i >= 0);
      let x = startX_L + mi * (cardW + M_CARD_GAP);
      if (parentIndices.length >= 2) x = (LP_pos[ri - 1][parentIndices[0]].x + LP_pos[ri - 1][parentIndices[1]].x) / 2;
      else if (parentIndices.length === 1) x = LP_pos[ri - 1][parentIndices[0]].x;
      return { x };
    });
  }

  const RP_pos = [];
  const rowW_R = RM[0].length * cardW + (RM[0].length - 1) * M_CARD_GAP;
  const startX_R = (containerWidth - rowW_R) / 2;
  RP_pos[0] = RM[0].map((_, mi) => ({ x: startX_R + mi * (cardW + M_CARD_GAP) }));

  for (let ri = 1; ri < NR; ri++) {
    RP_pos[ri] = RM[ri].map((m, mi) => {
      const parentIndices = rnl[ri - 1].map((nxt, pmi) => nxt === mi ? pmi : -1).filter(i => i >= 0);
      let x = startX_R + mi * (cardW + M_CARD_GAP);
      if (parentIndices.length >= 2) x = (RP_pos[ri - 1][parentIndices[0]].x + RP_pos[ri - 1][parentIndices[1]].x) / 2;
      else if (parentIndices.length === 1) x = RP_pos[ri - 1][parentIndices[0]].x;
      return { x };
    });
  }

  const nodes = [], connectors = [], phaseHeaders = [];
  let currentY = M_PAD;

  for (let ri = 0; ri < NR; ri++) {
    phaseHeaders.push({ label: tRound(rounds[ri].phase), y: currentY, count: LM[ri].length });
    currentY += M_HEADER_H;

    LM[ri].forEach((m, mi) => {
      nodes.push({ matchup: m, x: LP_pos[ri][mi].x, y: currentY, w: cardW });
    });
    
    const roundBottomY = currentY + M_CARD_H;
    currentY = roundBottomY;

    if (ri < NR - 1) {
      const nextTopY = currentY + M_ROUND_GAP + M_HEADER_H;
      const midY = currentY + M_ROUND_GAP / 2;

      LM[ri + 1].forEach((_, targetMi) => {
        const sourceIndices = LM[ri].map((pm, pmi) => pm._nextMatchIndex === targetMi ? pmi : -1).filter(i => i >= 0);
        if (sourceIndices.length === 0) return;
        
        const toX = LP_pos[ri + 1][targetMi].x + cardW / 2;
        const anyWinner = sourceIndices.some(pmi => LM[ri][pmi].isFinished && LM[ri][pmi].winnerId != null);

        if (sourceIndices.length >= 2) {
          const xs = sourceIndices.map(pmi => LP_pos[ri][pmi].x + cardW / 2).sort((a, b) => a - b);
          sourceIndices.forEach(pmi => connectors.push({ path: `M ${LP_pos[ri][pmi].x + cardW / 2} ${roundBottomY} V ${midY}`, isWinnerPath: anyWinner }));
          connectors.push({ path: `M ${xs[0]} ${midY} H ${xs[xs.length - 1]}`, isWinnerPath: anyWinner });
          connectors.push({ path: `M ${toX} ${midY} V ${nextTopY}`, isWinnerPath: anyWinner });
        } else {
          const fromX = LP_pos[ri][sourceIndices[0]].x + cardW / 2;
          connectors.push({ path: `M ${fromX} ${roundBottomY} V ${nextTopY}`, isWinnerPath: anyWinner });
        }
      });
      currentY += M_ROUND_GAP;
    }
  }

  currentY += M_ROUND_GAP / 2;
  const finalW = finalM ? Math.min(cardW * 1.2, 190) : cardW;
  const finalX = (containerWidth - finalW) / 2;

  if (finalM) {
    phaseHeaders.push({ label: '⭐ FINAL', y: currentY, count: 1, isFinal: true });
    currentY += M_HEADER_H;
    nodes.push({ matchup: finalM, x: finalX, y: currentY, w: finalW, isFinal: true });

    if (NR > 0 && LP_pos[NR - 1]?.length > 0) {
      const fromX = LP_pos[NR - 1][0].x + cardW / 2;
      const fromY = currentY - M_HEADER_H - M_ROUND_GAP / 2 - M_CARD_H; 
      const toX = finalX + finalW / 2;
      const toY = currentY; 
      const midY = (fromY + toY) / 2;
      const isWinner = LM[NR - 1][0]?.isFinished && LM[NR - 1][0]?.winnerId != null;
      connectors.push({ path: `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`, isWinnerPath: isWinner });
    }
    
    currentY += M_CARD_H;

    if (NR > 0 && RP_pos[NR - 1]?.length > 0) {
      const fromX = finalX + finalW / 2;
      const fromY = currentY;
      const toX = RP_pos[NR - 1][0].x + cardW / 2;
      const toY = currentY + M_ROUND_GAP / 2 + M_HEADER_H;
      const midY = (fromY + toY) / 2;
      const isWinner = RM[NR - 1][0]?.isFinished && RM[NR - 1][0]?.winnerId != null;
      connectors.push({ path: `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`, isWinnerPath: isWinner });
    }
    currentY += M_ROUND_GAP / 2;
  }

  for (let ri = NR - 1; ri >= 0; ri--) {
    phaseHeaders.push({ label: tRound(rounds[ri].phase), y: currentY, count: RM[ri].length });
    currentY += M_HEADER_H;

    RM[ri].forEach((m, mi) => {
      nodes.push({ matchup: m, x: RP_pos[ri][mi].x, y: currentY, w: cardW });
    });
    
    const roundBottomY = currentY + M_CARD_H;
    currentY = roundBottomY;

    if (ri > 0) {
      const nextTopY = currentY + M_ROUND_GAP + M_HEADER_H;
      const midY = currentY + M_ROUND_GAP / 2;

      RM[ri].forEach((_, sourceMi) => {
        const targetIndices = RM[ri - 1].map((cm, cmi) => rnl[ri - 1][cmi] === sourceMi ? cmi : -1).filter(i => i >= 0);
        if (targetIndices.length === 0) return;
        
        const fromX = RP_pos[ri][sourceMi].x + cardW / 2;
        const anyWinner = targetIndices.some(cmi => RM[ri - 1][cmi].isFinished && RM[ri - 1][cmi].winnerId != null);

        if (targetIndices.length >= 2) {
          const xs = targetIndices.map(cmi => RP_pos[ri - 1][cmi].x + cardW / 2).sort((a, b) => a - b);
          connectors.push({ path: `M ${fromX} ${roundBottomY} V ${midY}`, isWinnerPath: anyWinner });
          connectors.push({ path: `M ${xs[0]} ${midY} H ${xs[xs.length - 1]}`, isWinnerPath: anyWinner });
          targetIndices.forEach(cmi => connectors.push({ path: `M ${RP_pos[ri - 1][cmi].x + cardW / 2} ${midY} V ${nextTopY}`, isWinnerPath: anyWinner }));
        } else {
          const toX = RP_pos[ri - 1][targetIndices[0]].x + cardW / 2;
          connectors.push({ path: `M ${fromX} ${roundBottomY} V ${midY} H ${toX} V ${nextTopY}`, isWinnerPath: anyWinner });
        }
      });
      currentY += M_ROUND_GAP;
    }
  }

  return { nodes, connectors, phaseHeaders, width: containerWidth, height: currentY + M_PAD };
}

// ────────────────────────────────────────
// BRACKET VIEWER
// ────────────────────────────────────────
export default function BracketViewer({ columns, thirdPlace, isFullPage = false }) {
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const hasR32 = columns?.some(c => c.phase === 'Round of 32');
  const hasMainBracket = columns?.some(c => c.phase !== 'Round of 32');
  const [viewMode, setViewMode] = useState('bracket');
  const playoffMatchups = useMemo(() => (columns || []).filter(c => c.phase === 'Round of 32').flatMap(c => c.matchups), [columns]);
  const bracketColumns = useMemo(() => (columns || []).filter(c => c.phase !== 'Round of 32'), [columns]);

  const scrollRef = useRef(null);
  const measureRef = useCallback((node) => {
    scrollRef.current = node;
    if (node) setContainerWidth(node.clientWidth);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => { for (const e of entries) setContainerWidth(e.contentRect.width); });
    obs.observe(el);
    return () => obs.disconnect();
  }, [viewMode]);

  const isMobile = containerWidth > 0 && containerWidth < MOBILE_BREAKPOINT;
  const useMirrored = bracketColumns.length >= 3 && !isMobile;

  // Desktop layout
  const desktopLayout = useMemo(() => {
    if (isMobile || viewMode === 'playoffs' || containerWidth === 0) return { nodes: [], connectors: [], width: 0, height: 0, phaseHeaders: [] };
    if (useMirrored) return computeMirroredLayout(bracketColumns, containerWidth);
    return computeLayout(bracketColumns, containerWidth);
  }, [bracketColumns, containerWidth, viewMode, useMirrored, isMobile]);

  // Mobile vertical layout
  const mobileLayout = useMemo(() => {
    if (!isMobile || viewMode === 'playoffs' || containerWidth === 0) return { nodes: [], connectors: [], width: 0, height: 0, phaseHeaders: [] };
    return computeVerticalLayoutFixed(bracketColumns, containerWidth);
  }, [bracketColumns, containerWidth, viewMode, isMobile]);

  const layout = isMobile ? mobileLayout : desktopLayout;
  const { nodes, connectors, width, height, phaseHeaders } = layout;

  if (!columns?.length) {
    return <div className="glass-card rounded-2xl p-8 text-center text-white/40">No hay partidos de fase final disponibles.</div>;
  }

  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-3">
      {/* View toggle */}
      {hasR32 && hasMainBracket && (
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('bracket')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${viewMode === 'bracket' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            <GitBranch size={14} /> Llaves
          </button>
          <button onClick={() => setViewMode('playoffs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${viewMode === 'playoffs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            <List size={14} /> Playoffs
          </button>
        </div>
      )}

      {/* PLAYOFFS VIEW */}
      {viewMode === 'playoffs' && (
        <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">{tRound('Round of 32')}</span>
            <span className="text-[10px] text-slate-600">{playoffMatchups.length} partidos</span>
          </div>
          <PlayoffsList matchups={playoffMatchups} onSelect={setSelectedMatchup} isMobile={isMobile} />
        </m.div>
      )}

      {/* BRACKET VIEW */}
      {viewMode === 'bracket' && (
        <div ref={measureRef} className="rounded-xl border border-slate-800/50 overflow-hidden"
          style={{ background: isFullPage ? '#0a0e1a' : '#0d1220' }}>

          {containerWidth > 0 && (
            <div className="relative" style={{ width: `${width}px`, height: `${height}px`, minWidth: '100%' }}>
              {/* Phase headers */}
              {!isMobile && phaseHeaders?.map((ph, i) => (
                <div key={`ph-${i}`} className="absolute text-center" style={{ left: `${ph.x}px`, top: '8px', width: `${CARD_W}px`, zIndex: 3 }}>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-800/80 text-slate-400 border border-slate-700/50">{ph.label}</span>
                </div>
              ))}
              {isMobile && phaseHeaders?.map((ph, i) => (
                <div key={`mph-${i}`} className="absolute left-0 right-0 flex items-center gap-2 px-3" style={{ top: `${ph.y}px`, zIndex: 3 }}>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-800/80 text-slate-400 border border-slate-700/50">{ph.label}</span>
                  <div className="flex-1 h-px bg-slate-700/30" />
                  <span className="text-[9px] text-slate-600">{ph.count}</span>
                </div>
              ))}

              {/* SVG connectors */}
              <svg className="absolute inset-0 pointer-events-none" width={width} height={height} style={{ zIndex: 1 }}>
                {connectors.map((c, i) => (
                  <path key={i} d={c.path} fill="none" stroke={c.isWinnerPath ? '#3b82f6' : '#334155'}
                    strokeWidth={c.isWinnerPath ? 2 : 1.5} strokeLinecap="round" />
                ))}
              </svg>

              {/* Match cards */}
              {nodes.map((n, i) => (
                <div key={n.matchup.id} className="absolute" style={{ left: `${n.x}px`, top: `${n.y}px`, width: `${n.w || CARD_W}px`, zIndex: 2 }}>
                  {isMobile
                    ? <MobileVerticalCard matchup={n.matchup} index={i} cardW={n.w} onSelect={setSelectedMatchup} />
                    : <MatchCard matchup={n.matchup} index={i} onSelect={setSelectedMatchup} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Third place */}
      {thirdPlace?.matchups?.length > 0 && viewMode === 'bracket' && (
        <div className="mt-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1.5 px-1 block">{tRound('3rd Place Final')}</span>
          <div style={{ width: isMobile ? '50%' : `${CARD_W}px`, maxWidth: '180px' }}>
            {isMobile
              ? <MobileVerticalCard matchup={thirdPlace.matchups[0]} index={0} cardW={170} onSelect={setSelectedMatchup} />
              : <MatchCard matchup={thirdPlace.matchups[0]} index={0} onSelect={setSelectedMatchup} />}
          </div>
        </div>
      )}

      <div className="sr-only" role="tree" aria-label="Llaves del torneo">
        <ul>{(columns || []).map(col => (
          <li key={col.phase} role="treeitem"><span>{tRound(col.phase)}</span>
            <ul role="group">{col.matchups.map((m, i) => (
              <li key={i} role="treeitem">{m.teamA.name} {m.aggA ?? '-'} vs {m.teamB.name} {m.aggB ?? '-'}</li>
            ))}</ul>
          </li>
        ))}</ul>
      </div>

      <MatchDetailPanel matchup={selectedMatchup} onClose={() => setSelectedMatchup(null)} />
    </m.div>
  );
}
