import { m } from 'framer-motion';
import { tRound } from '../../utils/translations';

/**
 * Phase filter pills with Framer Motion layoutId animation.
 * "Todos" shows the full bracket; clicking a specific phase scrolls/highlights it.
 */
export default function RoundSelector({ phases, activePhase, onSelect }) {
  if (!phases || phases.length <= 1) return null;

  const options = [
    { id: 'all', label: 'Todos' },
    ...phases.map(p => ({ id: p, label: tRound(p) })),
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
      {options.map(opt => {
        const isActive = activePhase === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`relative px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border-none cursor-pointer ${
              isActive
                ? 'text-white'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            {isActive && (
              <m.div
                layoutId="round-pill"
                className="absolute inset-0 bg-blue-600 rounded-full"
                style={{ zIndex: -1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {!isActive && (
              <div className="absolute inset-0 bg-slate-800 rounded-full" style={{ zIndex: -1 }} />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
