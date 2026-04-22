import { m } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTilt } from "../../hooks/useTilt";

/**
 * Compact match card for bracket.
 * - Click on team NAME text → team page
 * - Click anywhere else → detail panel (onSelect)
 * - Unplayed matches: show date, non-clickable for panel
 * - Hide empty logo placeholders
 */
export default function MatchCard({ matchup, index = 0, onSelect }) {
  const tiltRef = useTilt(6);
  const navigate = useNavigate();
  const {
    teamA,
    teamB,
    aggA,
    aggB,
    legs,
    winnerId,
    isFinished,
    isLive,
    isAggregate,
  } = matchup;

  const isPlayed = isFinished || isLive;

  // Match date from first leg
  const matchDate = legs?.[0]?.fixture?.date;
  const liveMinute = isLive
    ? legs?.find((l) =>
        ["1H", "2H", "HT", "ET", "BT", "P"].includes(l.fixture.status?.short),
      )?.fixture?.status?.elapsed
    : null;

  const formatDate = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    const day = dt.getDate();
    const month = dt.toLocaleString("es", { month: "short" }).replace(".", "");
    return `${day} ${month}`;
  };

  const hasLogo = (team) => team.logo && team.id > 0;

  const Row = ({ team, goals, isWinner, isLoser }) => (
    <div
      className={`flex items-center gap-1.5 px-2 py-[5px] transition-all ${isWinner ? "bg-emerald-500/[0.06]" : ""}`}
    >
      {hasLogo(team) ? (
        <img           src={team.logo}
          alt=""
          className="w-4 h-4 object-contain shrink-0"
          loading="lazy"
          decoding="async" width={16} height={16}
  onError={(e) => {
            e.target.src = "/placeholder-team.svg";
          }}
        />
      ) : (
        <span className="w-4 h-4 shrink-0" />
      )}
      <span
        className={`flex-1 text-[11px] font-semibold truncate cursor-default ${isWinner ? "text-white" : isLoser ? "text-slate-400" : "text-white/80"}`}
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {team.name}
      </span>
      <span
        className={`text-[11px] font-bold font-mono min-w-[14px] text-right shrink-0 ${
          isWinner
            ? "text-emerald-300"
            : isLoser
              ? "text-slate-500"
              : "text-white/50"
        }`}
      >
        {isPlayed ? (goals ?? "-") : "-"}
      </span>
      {isWinner && (
        <span className="text-emerald-400 text-[8px] shrink-0">✓</span>
      )}
    </div>
  );

  return (
    <m.div
      ref={tiltRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.03, 0.6),
        duration: 0.3,
        ease: "easeOut",
      }}
      onClick={() => isPlayed && onSelect?.(matchup)}
      className={`bg-slate-900/90 border border-slate-700/70 rounded-lg shadow-lg overflow-hidden w-full transition-colors ${
        isPlayed
          ? "cursor-pointer hover:border-slate-600/80"
          : "cursor-default opacity-70"
      }`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Status / date bar */}
      <div className="flex items-center justify-between px-2 py-[2px] bg-slate-800/30">
        {/* Date or minute */}
        <span className="text-[8px] text-slate-500 font-medium">
          {isLive && liveMinute
            ? ""
            : isFinished
              ? ""
              : formatDate(matchDate) || ""}
        </span>
        <span
          className={`text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5 ${
            isLive
              ? "text-red-500"
              : isFinished
                ? "text-emerald-400"
                : "text-slate-500"
          }`}
        >
          {isLive && (
            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse inline-block" />
          )}
          {isLive && liveMinute ? `${liveMinute}'` : isFinished ? "FIN" : "—"}
        </span>
      </div>

      <Row
        team={teamA}
        goals={aggA}
        isWinner={winnerId === teamA.id}
        isLoser={isFinished && winnerId && winnerId !== teamA.id}
      />
      <div className="h-px bg-slate-700/30 mx-1.5" />
      <Row
        team={teamB}
        goals={aggB}
        isWinner={winnerId === teamB.id}
        isLoser={isFinished && winnerId && winnerId !== teamB.id}
      />

      {/* Leg scores — only show if played */}
      {isAggregate && legs.length > 1 && isPlayed && (
        <div className="px-2 py-[2px] bg-slate-800/15 border-t border-slate-700/20 flex gap-1.5 justify-center">
          {legs.map((leg, li) => {
            const legPlayed = ["FT", "AET", "PEN"].includes(
              leg.fixture.status?.short,
            );
            return (
              <span key={leg.fixture.id} className="text-[8px] text-slate-500">
                {li === 0 ? "I" : "V"}:{" "}
                {legPlayed
                  ? `${leg.goals?.home ?? "?"}-${leg.goals?.away ?? "?"}`
                  : "-"}
              </span>
            );
          })}
        </div>
      )}
    </m.div>
  );
}
