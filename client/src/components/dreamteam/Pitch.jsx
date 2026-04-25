import { m } from "framer-motion";

export default function Pitch({ formation, players, onRemove }) {
  // A helper to place players on the pitch relative to %.
  // We'll use absolute positioning from top (0% is opponent goal, 100% is our goal).

  // formations coordinates (y, x).
  // Our goal is at bottom. Y is from top (0) to bottom (100).
  const positions = {
    "1-2-1": {
      gk: { top: "85%", left: "50%" },
      def1: { top: "60%", left: "30%" },
      def2: { top: "60%", left: "70%" },
      mid1: null,
      mid2: { top: "35%", left: "50%" }, // single mid
      fwd1: { top: "15%", left: "50%" },
      fwd2: null,
    },
    "1-1-2": {
      gk: { top: "85%", left: "50%" },
      def1: null,
      def2: { top: "65%", left: "50%" },
      mid1: { top: "40%", left: "50%" },
      mid2: null,
      fwd1: { top: "15%", left: "30%" },
      fwd2: { top: "15%", left: "70%" },
    },
    "2-1-1": {
      gk: { top: "85%", left: "50%" },
      def1: { top: "65%", left: "30%" },
      def2: { top: "65%", left: "70%" },
      mid1: { top: "40%", left: "50%" },
      mid2: null,
      fwd1: { top: "15%", left: "50%" },
      fwd2: null,
    },
  };

  const layout = positions[formation];

  const renderSlot = (slotKey, role) => {
    if (!layout[slotKey]) return null; // Slot no existe en esta formación

    const pInfo = players[slotKey];

    return (
      <div
        key={slotKey}
        className="absolute w-16 h-16 md:w-20 md:h-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-110"
        style={{
          top: layout[slotKey].top,
          left: layout[slotKey].left,
          zIndex: 10,
        }}
        onClick={() => {
          if (pInfo) {
            onRemove(slotKey);
          }
        }}
      >
        {pInfo ? (
          <m.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="relative"
          >
            <div
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-2 shadow-xl bg-slate-800 ${
                role === "GK" ? "border-amber-400" : "border-indigo-400"
              } overflow-hidden`}
            >
              <img
                src={
                  pInfo.image ||
                  "https://cdn-icons-png.flaticon.com/512/3112/3112946.png"
                }
                alt={pInfo.name}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                
  onError={(e) => {
                  e.target.src = "/placeholder-team.svg";
                }}
              />
            </div>

            <div className="absolute -bottom-2 -left-4 -right-4 backdrop-blur-sm border border-white/10 rounded-md text-[9px] md:text-[10px] text-white font-bold tracking-tight text-center truncate px-1 shadow-lg" style={{ background: 'color-mix(in srgb, var(--bg-start-color, #0f172a) 90%, transparent)' }}>
              {pInfo.name.split(" ").pop()}
            </div>
            {/* Remove button overlay on hover managed by outside click/hover */}
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-bold leading-none">
                &times;
              </span>
            </div>
          </m.div>
        ) : (
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-dashed border-white/30 bg-white/5 flex items-center justify-center shadow-lg backdrop-blur-sm relative group">
            <span className="text-white/50 text-xs font-bold font-mono group-hover:text-white/60 transition-colors uppercase">
              {role}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="w-full max-w-[500px] aspect-[2/3] mx-auto rounded-3xl overflow-hidden shadow-2xl relative border-8 border-green-900/50 bg-[#2d5a27]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "100% 10%",
      }}
    >
      {/* Pattern Pasto (Zonas oscuras/claras) */}
      <div className="absolute inset-0 opacity-20 pointer-events-none flex flex-col">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 ${i % 2 === 0 ? "bg-black/20" : "bg-transparent"}`}
          ></div>
        ))}
      </div>

      {/* Lineas de la cancha */}
      <div className="absolute inset-0 pointer-events-none p-4 opacity-70">
        <div className="w-full h-full border-2 border-white/50 relative">
          {/* Halfway line */}
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/50"></div>
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white/50 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          {/* Center spot */}
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white/50 rounded-full -translate-x-1/2 -translate-y-1/2"></div>

          {/* Top Penalty Area */}
          <div className="absolute top-0 left-1/2 w-48 h-24 border-2 border-t-0 border-white/50 -translate-x-1/2"></div>
          {/* Top Goal Area */}
          <div className="absolute top-0 left-1/2 w-24 h-8 border-2 border-t-0 border-white/50 -translate-x-1/2"></div>

          {/* Bottom Penalty Area */}
          <div className="absolute bottom-0 left-1/2 w-48 h-24 border-2 border-b-0 border-white/50 -translate-x-1/2"></div>
          {/* Bottom Goal Area */}
          <div className="absolute bottom-0 left-1/2 w-24 h-8 border-2 border-b-0 border-white/50 -translate-x-1/2"></div>
        </div>
      </div>

      {/* Players */}
      {renderSlot("fwd1", "FWD")}
      {renderSlot("fwd2", "FWD")}
      {renderSlot("mid1", "MID")}
      {renderSlot("mid2", "MID")}
      {renderSlot("def1", "DEF")}
      {renderSlot("def2", "DEF")}
      {renderSlot("gk", "GK")}
    </div>
  );
}
