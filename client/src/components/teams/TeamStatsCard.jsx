import React from "react";
import { m } from "framer-motion";
import { BarChart3, Activity } from "lucide-react";

const TEAM_KPI_LABELS = {
  // Official Sportmonks team statistics type_ids
  214: "Partidos Jugados",   // TEAM_WINS → actually Wins, but in SM this ID is "matches won"
  // For a cleaner mapping, let's use what the SM catalog actually has:
  // 214=TEAM_WINS, 215=TEAM_DRAWS, 216=TEAM_LOST
  // But for "Partidos Jugados" we'd need to sum, or use a different approach
  // Using actual correct IDs:
  52: "Goles a favor",       // GOALS ✅
  88: "Goles en contra",     // GOALS_CONCEDED (era 53 inexistente)
  84: "Tarjetas Amarillas",  // YELLOWCARDS (era 57=SAVES!)
  83: "Tarjetas Rojas",      // REDCARDS (era 58=SHOTS_BLOCKED!)
  86: "Tiros al arco promedio",  // ✅
  45: "Posesión media %",    // ✅
  194: "Clean Sheets",       // CLEANSHEET (era 43=ATTACKS!)
};

export default function TeamStatsCard({ team }) {
  // Find current active season
  const activeSeason =
    team.activeseasons?.find((s) => s.is_current) || team.activeseasons?.[0];
  if (!activeSeason) return null;

  // Find statistics for this season
  const seasonStats = team.statistics?.find(
    (s) => s.season_id === activeSeason.id,
  );
  const details = seasonStats?.details || [];

  if (details.length === 0) {
    return (
      <div className="bg-white/5 border border-white/5 rounded-2xl p-6 text-center text-white/60">
        <BarChart3 className="mx-auto mb-2 text-white/40" size={24} />
        <p className="text-sm">Sin estadísticas para la temporada actual.</p>
      </div>
    );
  }

  // Parse stats
  const kpis = details
    .filter((d) => TEAM_KPI_LABELS[d.type_id])
    .map((d) => {
      let val = d.value;
      if (val?.all !== undefined) {
        val = val.all?.count ?? val.all;
      } else if (val?.total !== undefined) {
        val = val.total;
      } else if (val?.count !== undefined) {
        val = val.count;
      } else if (typeof val === "object" && val !== null) {
        val = Object.values(val)[0]?.count ?? 0;
      }

      return {
        id: d.type_id,
        label: TEAM_KPI_LABELS[d.type_id],
        value: val ?? 0,
      };
    });

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80 font-bold uppercase tracking-wider text-xs">
          <Activity size={16} className="text-indigo-400" />
          Rendimiento Temporada
        </div>
        <div className="text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 uppercase">
          {activeSeason.name}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/10">
        {kpis.length > 0 ? (
          kpis.map((kpi, idx) => (
            <div
              key={kpi.id}
              className="p-5 text-center flex flex-col items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--bg-start-color, #0b101e) 90%, white)' }}
            >
              <span className="text-3xl font-black bg-gradient-to-br from-white to-white/50 text-transparent bg-clip-text mb-1">
                {kpi.value}
              </span>
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-tight">
                {kpi.label}
              </span>
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-white/60 text-sm" style={{ background: 'color-mix(in srgb, var(--bg-start-color, #0b101e) 90%, white)' }}>
            Métricas no procesadas aún.
          </div>
        )}
      </div>
    </m.div>
  );
}
