/**
 * LineupPlayer — Nodo de jugador en la canchita táctica
 * Diseño: Círculo con dorsal grande + rating badge + nombre debajo
 * Click para ver estadísticas del partido
 */
import { m } from "framer-motion";

/** Color system based on rating */
function getRatingStyle(rating) {
  if (!rating || rating === 0)
    return {
      ring: "ring-white/20",
      bg: "bg-slate-700/80",
      text: "text-white/60",
      glow: "",
    };
  if (rating >= 8.5)
    return {
      ring: "ring-emerald-400",
      bg: "bg-emerald-900/60",
      text: "text-emerald-400",
      glow: "shadow-[0_0_12px_rgba(52,211,153,0.4)]",
    };
  if (rating >= 7.0)
    return {
      ring: "ring-green-400",
      bg: "bg-green-900/50",
      text: "text-green-400",
      glow: "",
    };
  if (rating >= 6.0)
    return {
      ring: "ring-amber-400",
      bg: "bg-amber-900/40",
      text: "text-amber-400",
      glow: "",
    };
  return {
    ring: "ring-red-400",
    bg: "bg-red-900/40",
    text: "text-red-400",
    glow: "",
  };
}

/** "Lionel Messi" → "L. Messi" */
function shortName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length <= 1) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

/**
 * Stat type IDs for player match stats in Sportmonks lineups.details
 */
const PLAYER_STAT_TYPES = {
  118: "Rating",
  52: "Goles",
  110: "Asistencias",
  119: "Minutos",
  98: "Amarillas",
  580: "Rojas",
  86: "Tiros al arco",
  42: "Tiros totales",
  78: "Entradas",
  117: "Pases clave",
  80: "Pases totales",
  116: "Pases precisos",
  51: "Intercepciones",
  1535: "Atajadas",
  96: "Faltas cometidas",
  122: "Duelos ganados",
  123: "Duelos perdidos",
  9706: "Goles en contra",
};

function extractPlayerStats(details) {
  if (!Array.isArray(details) || details.length === 0) return null;

  const stats = [];
  for (const d of details) {
    const label = PLAYER_STAT_TYPES[d.type_id];
    if (!label) continue;

    let value = d.data?.value ?? d.value;
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && value.total !== undefined)
      value = value.total;
    if (typeof value === "object") continue;

    // Skip zeros for non-essential stats
    if (value === 0 && d.type_id !== 118 && d.type_id !== 119) continue;

    stats.push({ label, value, typeId: d.type_id });
  }

  return stats.length > 0 ? stats : null;
}

export default function LineupPlayer({ player, index = 0, onPlayerClick }) {
  const rating = player?.rating ? parseFloat(player.rating) : 0;
  const style = getRatingStyle(rating);
  const number = player?.jerseyNumber || player?.jersey_number || "";
  const name = shortName(player?.playerName || player?.player_name || "");
  const fullName = player?.playerName || player?.player_name || "";
  const imagePath = player?.imagePath || player?.image_path;

  const hasStats = player?.details?.length > 0;

  const handleClick = (e) => {
    e.stopPropagation();
    if (!onPlayerClick) return;

    const stats = extractPlayerStats(player.details);
    onPlayerClick({
      playerId: player.player_id || player.playerId,
      name: fullName,
      number,
      rating,
      imagePath,
      stats,
    });
  };

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.035,
        duration: 0.3,
        type: "spring",
        stiffness: 200,
      }}
      className={`flex flex-col items-center w-[60px] md:w-[72px] ${hasStats || onPlayerClick ? "cursor-pointer" : ""}`}
      onClick={handleClick}
    >
      {/* Circle container */}
      <div
        className={`relative w-11 h-11 md:w-14 md:h-14 rounded-full ${style.bg} ring-2 ${style.ring} ${style.glow} flex flex-col items-center justify-center transition-transform hover:scale-110`}
      >
        {imagePath ? (
          <>
            {/* Player Photo */}
            <img               src={imagePath}
              alt={name}
              className="w-full h-full object-cover rounded-full overflow-hidden"
              loading="lazy" decoding="async"
  onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            {/* Jersey Number Overlay */}
            {number && (
              <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-black/80 text-white text-[8px] md:text-[10px] font-black rounded-full flex items-center justify-center border border-white/20">
                {number}
              </div>
            )}
            {/* Rating Overlay */}
            {rating > 0 && (
              <div
                className={`absolute -bottom-1.5 px-1.5 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold border border-white/20 ${style.bg} ${style.text}`}
              >
                {rating.toFixed(1)}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Fallback Graphic (Number) */}
            <span className="text-white font-black text-sm md:text-lg leading-none">
              {number}
            </span>
            {rating > 0 && (
              <span
                className={`${style.text} text-[8px] md:text-[10px] font-bold leading-none mt-0.5`}
              >
                {rating.toFixed(1)}
              </span>
            )}
          </>
        )}
      </div>

      {/* Name below */}
      <div className="mt-1 text-[8px] md:text-[10px] text-white/90 font-semibold text-center leading-tight truncate w-full px-0.5">
        {name}
      </div>
    </m.div>
  );
}
