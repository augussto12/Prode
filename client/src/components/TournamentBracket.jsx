import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { tRound } from '../utils/translations';

// Knockout round keys in order of progression
const KNOCKOUT_PHASES = [
  'Round of 32',
  'Round of 16',
  'Round of 16 - 2nd Leg',
  'Quarter-finals',
  'Quarter-finals - 2nd Leg',
  'Semi-finals',
  'Semi-finals - 2nd Leg',
  '3rd Place Final',
  'Final',
  // Champions League new format
  'Play Offs',
  'Play-offs',
  'Knockout Round Play-offs',
  'Knockout Round Play-offs - 2nd Leg',
];

// Normalize round names to group legs together — ONLY main knockout phases
function normalizePhase(round) {
  if (!round) return null;
  const r = round.toLowerCase();
  if (r.includes('round of 32')) return 'Round of 32';
  if (r.includes('round of 16') || r.includes('1/8')) return 'Round of 16';
  if (r.includes('quarter') || r.includes('1/4')) return 'Quarter-finals';
  if (r.includes('semi') || r.includes('1/2')) return 'Semi-finals';
  if (r.includes('3rd place')) return '3rd Place Final';
  if (r === 'final') return 'Final';
  return null;
}

const PHASE_ORDER = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place Final', 'Final'];

// Group fixtures into matchups (ida/vuelta by team pairing)
function groupMatchups(fixtures) {
  const map = {};
  fixtures.forEach(f => {
    const homeId = f.teams.home.id;
    const awayId = f.teams.away.id;
    // Create a consistent key regardless of home/away flip between legs
    const key = [Math.min(homeId, awayId), Math.max(homeId, awayId)].join('-');
    if (!map[key]) map[key] = [];
    map[key].push(f);
  });
  
  return Object.values(map).map(legs => {
    // Sort by date so leg 1 comes first
    legs.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    
    const leg1 = legs[0];
    const leg2 = legs[1] || null;
    
    // Determine the "home" team as whoever was home in leg 1
    const teamA = { ...leg1.teams.home, logo: leg1.teams.home.logo };
    const teamB = { ...leg1.teams.away, logo: leg1.teams.away.logo };
    
    // Aggregate score across legs
    let aggA = leg1.goals?.home ?? null;
    let aggB = leg1.goals?.away ?? null;
    
    if (leg2) {
      // In leg 2, team positions may be flipped
      if (leg2.teams.home.id === teamA.id) {
        aggA = (aggA ?? 0) + (leg2.goals?.home ?? 0);
        aggB = (aggB ?? 0) + (leg2.goals?.away ?? 0);
      } else {
        aggA = (aggA ?? 0) + (leg2.goals?.away ?? 0);
        aggB = (aggB ?? 0) + (leg2.goals?.home ?? 0);
      }
    }
    
    // Determine winner
    let winnerId = null;
    const isFinished = legs.every(l => ['FT', 'AET', 'PEN'].includes(l.fixture.status?.short));
    if (isFinished) {
      if (aggA > aggB) winnerId = teamA.id;
      else if (aggB > aggA) winnerId = teamB.id;
      else {
        // Check penalties in last leg
        const lastLeg = leg2 || leg1;
        if (lastLeg.score?.penalty?.home != null) {
          const penHome = lastLeg.score.penalty.home;
          const penAway = lastLeg.score.penalty.away;
          if (lastLeg.teams.home.id === teamA.id) {
            winnerId = penHome > penAway ? teamA.id : teamB.id;
          } else {
            winnerId = penAway > penHome ? teamA.id : teamB.id;
          }
        }
      }
    }
    
    return {
      teamA,
      teamB,
      aggA,
      aggB,
      legs,
      winnerId,
      isFinished,
    };
  });
}

export default function TournamentBracket({ fixtures }) {
  const navigate = useNavigate();
  
  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-white/40">
        No hay partidos de fase final disponibles.
      </div>
    );
  }
  
  // Group fixtures by normalized phase
  const phaseMap = {};
  fixtures.forEach(f => {
    const round = f.league?.round || '';
    const phase = normalizePhase(round);
    if (phase) {
      if (!phaseMap[phase]) phaseMap[phase] = [];
      phaseMap[phase].push(f);
    }
  });
  
  // Order phases
  const orderedPhases = PHASE_ORDER.filter(p => phaseMap[p]);
  
  if (orderedPhases.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-white/40">
        No se encontraron fases de eliminación en estos partidos.
      </div>
    );
  }
  
  // Build matchups per phase
  const bracket = orderedPhases.map(phase => ({
    phase,
    label: tRound(phase),
    matchups: groupMatchups(phaseMap[phase]),
  }));
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-1"
    >
      {/* Horizontal bracket view */}
      <div className="text-xs text-white/40 mb-2 flex items-center justify-end sm:hidden px-2 gap-1 animate-pulse">
         <span>Deslizá para ver más</span> <ArrowRight size={12} />
      </div>
      <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10">
        <div className="flex gap-3 min-w-max items-start">
          {bracket.map((col, ci) => (
            <div key={col.phase} className="flex flex-col items-center min-w-[260px]">
              {/* Phase Header */}
              <div className="text-center mb-3 w-full">
                <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 text-white/60 border border-white/10">
                  {col.label}
                </span>
              </div>
              
              {/* Matchups */}
              <div className="flex flex-col gap-3 w-full" style={{ justifyContent: 'space-around', minHeight: ci === 0 ? 'auto' : undefined }}>
                {col.matchups.map((mu, mi) => (
                  <MatchupCard key={mi} matchup={mu} navigate={navigate} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function MatchupCard({ matchup, navigate }) {
  const { teamA, teamB, aggA, aggB, legs, winnerId, isFinished } = matchup;
  const isLive = legs.some(l => ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(l.fixture.status?.short));
  
  return (
    <div 
      className={`glass-card rounded-xl overflow-hidden border transition-all hover:scale-[1.02] ${
        isLive ? 'border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]' : 'border-white/5'
      }`}
    >
      {/* Team A */}
      <TeamRow 
        team={teamA} 
        goals={aggA} 
        isWinner={winnerId === teamA.id} 
        isLoser={isFinished && winnerId && winnerId !== teamA.id}
        navigate={navigate}
      />
      
      {/* Divider with status */}
      <div className="flex items-center px-3 py-1 bg-white/[0.02] border-y border-white/5">
        <div className="flex-1 h-px bg-white/10"></div>
        <span className={`px-2 text-[10px] font-bold uppercase tracking-wider ${
          isLive ? 'text-red-400 animate-pulse' : isFinished ? 'text-white/30' : 'text-white/20'
        }`}>
          {isLive ? 'EN VIVO' : isFinished ? 'FIN' : legs.length > 1 ? 'IDA Y VUELTA' : 'vs'}
        </span>
        <div className="flex-1 h-px bg-white/10"></div>
      </div>
      
      {/* Team B */}
      <TeamRow 
        team={teamB} 
        goals={aggB}
        isWinner={winnerId === teamB.id}
        isLoser={isFinished && winnerId && winnerId !== teamB.id}
        navigate={navigate}
      />
      
      {/* Leg details (small) */}
      {legs.length > 0 && (
        <div className="px-3 py-1.5 bg-white/[0.01] border-t border-white/5 flex gap-2 justify-center">
          {legs.map((leg, li) => (
            <button 
              key={leg.fixture.id}
              onClick={() => navigate(`/partido/${leg.fixture.id}`)}
              className="text-[10px] text-white/30 hover:text-indigo-300 transition-colors cursor-pointer bg-transparent border-none"
            >
              {legs.length > 1 ? `${li === 0 ? 'Ida' : 'Vuelta'}: ` : ''}
              {leg.goals?.home ?? '?'} - {leg.goals?.away ?? '?'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRow({ team, goals, isWinner, isLoser, navigate }) {
  return (
    <div 
      onClick={() => navigate(`/equipo/${team.id}`)}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all hover:bg-white/[0.03] ${
        isWinner ? 'bg-emerald-500/[0.06]' : isLoser ? 'opacity-40' : ''
      }`}
    >
      <img src={team.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
      <span className={`flex-1 text-xs font-medium truncate ${
        isWinner ? 'text-emerald-300' : 'text-white'
      }`}>
        {team.name}
      </span>
      <span className={`text-sm font-bold font-mono min-w-[20px] text-right ${
        isWinner ? 'text-emerald-300' : 'text-white/70'
      }`}>
        {goals ?? '-'}
      </span>
      {isWinner && (
        <span className="text-emerald-400 text-[10px]">✓</span>
      )}
    </div>
  );
}

// Helper: check if fixtures contain knockout rounds
export function hasKnockoutFixtures(fixtures) {
  if (!fixtures || fixtures.length === 0) return false;
  return fixtures.some(f => {
    const round = f.league?.round || '';
    return normalizePhase(round) !== null;
  });
}
