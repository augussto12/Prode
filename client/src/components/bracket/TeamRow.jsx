import { useNavigate } from 'react-router-dom';

/**
 * Single team row inside a MatchCard.
 * Shows logo, name, aggregate score, and winner indicator.
 */
export default function TeamRow({ team, goals, isWinner, isLoser }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/equipo/${team.id}`);
      }}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-200 hover:bg-white/[0.04] ${
        isWinner
          ? 'bg-emerald-500/[0.08]'
          : isLoser
            ? 'opacity-40'
            : ''
      }`}
    >
      <img         src={team.logo}
        alt=""
        className="w-6 h-6 object-contain shrink-0"
        loading="lazy"
      onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
      <span
        className={`flex-1 text-xs font-semibold truncate ${
          isWinner ? 'text-white winner-glow' : isLoser ? 'text-slate-500' : 'text-white/90'
        }`}
      >
        {team.name}
      </span>
      <span
        className={`text-sm font-bold font-mono min-w-[20px] text-right ${
          isWinner ? 'text-emerald-300' : isLoser ? 'text-slate-600' : 'text-white/70'
        }`}
      >
        {goals ?? '-'}
      </span>
      {isWinner && (
        <span className="text-emerald-400 text-xs">✓</span>
      )}
    </div>
  );
}
