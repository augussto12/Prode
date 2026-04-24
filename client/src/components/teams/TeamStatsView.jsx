import { useMemo, useState } from "react";
import { m } from "framer-motion";
import {
  Target,
  Shield,
  Clock,
  BarChart3,
  Star,
  Zap,
  TrendingUp,
} from "lucide-react";
import {
  mapTeamSeasonStats,
  getStat,
  SM_STAT_TYPES,
} from "../../utils/teamStatsMapper";

const PERIODS = ["0-15", "15-30", "30-45", "45-60", "60-75", "75-90"];

export default function TeamStatsView({ team }) {
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);

  // Find all statistics entries that have data
  const availableSeasons = useMemo(() => {
    if (!team.statistics?.length) return [];
    return team.statistics
      .filter((s) => s.has_values && s.details?.length > 10) // at least 10 details = real data
      .map((s) => {
        // Try to find season name
        const season = s.season ||
          (team.seasons || []).find((se) => se.id === s.season_id) ||
          (team.activeseasons || []).find((se) => se.id === s.season_id);
        return {
          seasonId: s.season_id,
          name: season?.name || `Temp. ${s.season_id}`,
          leagueName: season?.league?.name || null,
          details: s.details,
        };
      });
  }, [team.statistics, team.seasons, team.activeseasons]);

  const stats = useMemo(() => {
    if (!availableSeasons.length) return null;
    const sel = availableSeasons[selectedSeasonIdx] || availableSeasons[0];
    return mapTeamSeasonStats(sel.details);
  }, [availableSeasons, selectedSeasonIdx]);

  if (!stats || !availableSeasons.length) {
    return (
      <div className="bg-white/5 border border-white/5 rounded-2xl p-8 text-center text-white/50">
        <BarChart3 className="mx-auto mb-2 opacity-30" size={28} />
        <p className="text-sm">Sin estadísticas disponibles.</p>
      </div>
    );
  }

  const currentSeason =
    availableSeasons[selectedSeasonIdx] || availableSeasons[0];
  const { attack, defense, timing, performance, possession, discipline } =
    stats;

  // Calculate totals properly: PJ = W + D + L
  const wins = stats.matches.wins?.all?.count ?? 0;
  const draws = stats.matches.draws?.all?.count ?? 0;
  const losses = stats.matches.losses?.all?.count ?? 0;
  const played = wins + draws + losses;
  const goalsFor = attack.goals?.all?.count ?? 0;
  const goalsAgainst = defense.goalsAgainst?.total ?? 0;
  const rating = performance.rating?.value ?? 0;
  const cleanSheets = defense.cleanSheets?.all?.count ?? 0;

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Season Selector */}
      {availableSeasons.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
          {availableSeasons.map((s, i) => (
            <button
              key={s.seasonId}
              onClick={() => setSelectedSeasonIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border-none cursor-pointer ${i === selectedSeasonIdx
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/60"
                }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Season Header */}
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-indigo-400" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">
          {currentSeason.name}
        </h3>
      </div>

      {/* ══════ MVP Card ══════ */}
      {performance.mvp && (
        <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Star size={22} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-widest">
              MVP de la Temporada
            </p>
            <p className="text-lg font-black text-white truncate">
              {performance.mvp.player_name || "N/D"}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-2xl font-black text-amber-400">
              {performance.mvp.rating?.toFixed(2) ?? "—"}
            </span>
            <p className="text-[10px] text-white/50">Rating</p>
          </div>
        </div>
      )}

      {/* ══════ KPI Summary ══════ */}
      <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-white/50 mb-3">
          <TrendingUp size={14} />
          <h4 className="text-xs font-bold uppercase tracking-widest">
            Resumen
          </h4>
          {rating > 0 && (
            <span className="ml-auto text-xs font-bold text-indigo-400">
              {typeof rating === "number" ? rating.toFixed(2) : rating} ★
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <KpiBox label="PJ" value={played} sublabel="Jugados" />
          <KpiBox
            label="PG"
            value={wins}
            sublabel="Ganados"
            color="text-emerald-400"
          />
          <KpiBox
            label="PE"
            value={draws}
            sublabel="Empates"
            color="text-amber-400"
          />
          <KpiBox
            label="PP"
            value={losses}
            sublabel="Perdidos"
            color="text-red-400"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <KpiBox
            label="GF"
            value={goalsFor}
            sublabel="Goles a favor"
            color="text-indigo-400"
          />
          <KpiBox
            label="GC"
            value={goalsAgainst}
            sublabel="Goles en contra"
            color="text-orange-400"
          />
          <KpiBox
            label="DG"
            value={goalsFor - goalsAgainst}
            sublabel="Diferencia"
            color={
              goalsFor - goalsAgainst >= 0 ? "text-emerald-400" : "text-red-400"
            }
          />
        </div>
      </div>

      {/* ══════ Attack + Defense ══════ */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* Attack */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-3">
            <Target size={16} />
            <h4 className="text-xs font-bold uppercase tracking-widest">
              Ataque
            </h4>
          </div>
          <div className="space-y-2">
            <StatRow
              label="Goles"
              value={goalsFor}
              detail={`${attack.goals?.home?.count ?? 0} local · ${attack.goals?.away?.count ?? 0} visitante`}
            />
            <StatRow label="Tiros totales" value={attack.shots?.total} />
            <StatRow label="Tiros al arco" value={attack.shots?.on_target} />
            <StatRow
              label="Asistencias"
              value={attack.assists?.total_assists}
            />
            {attack.penalties && (
              <StatRow
                label="Penales"
                value={`${attack.penalties.scored ?? 0}/${(attack.penalties.scored ?? 0) + (attack.penalties.missed ?? 0)}`}
                detail={`${(attack.penalties.conversion_rate ?? 0).toFixed(0)}% efectividad`}
              />
            )}
            <StatRow
              label="Posesión promedio"
              value={`${possession.average?.average ?? possession.average?.count ?? 0}%`}
            />
            <StatRow
              label="Corners"
              value={
                defense.fouls?.total
                  ? `${stats.possession.corners?.count ?? 0}`
                  : stats.possession.corners?.count
              }
            />
          </div>
        </div>

        {/* Defense */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sky-400 mb-3">
            <Shield size={16} />
            <h4 className="text-xs font-bold uppercase tracking-widest">
              Defensa
            </h4>
          </div>
          <div className="space-y-2">
            <StatRow
              label="Valla invicta"
              value={cleanSheets}
              detail={`${defense.cleanSheets?.home?.count ?? 0} local · ${defense.cleanSheets?.away?.count ?? 0} visitante`}
            />
            <StatRow label="Goles recibidos" value={goalsAgainst} />
            <StatRow
              label="Intercepciones / PJ"
              value={
                defense.interceptions?.interceptions_per_game?.toFixed?.(1) ??
                defense.interceptions?.interceptions_per_game
              }
            />
            <StatRow label="Entradas" value={defense.tackles?.count} />
            <StatRow label="Faltas cometidas" value={defense.fouls?.total} />
            <StatRow
              label="🟨 Amarillas"
              value={discipline.yellowCards?.count ?? 0}
            />
            <StatRow label="🟥 Rojas" value={discipline.redCards?.count ?? 0} />
          </div>
        </div>
      </div>

      {/* ══════ Goals Timing ══════ */}
      {timing.goalsByPeriod && (
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-violet-400 mb-4">
            <Clock size={16} />
            <h4 className="text-xs font-bold uppercase tracking-widest">
              Goles por período (min)
            </h4>
          </div>
          <div className="grid grid-cols-6 gap-1.5 items-end h-28">
            {PERIODS.map((period) => {
              const scored = timing.goalsByPeriod?.[period]?.count ?? 0;
              const conceded =
                timing.goalsConcededByPeriod?.[period]?.count ?? 0;
              const maxVal = Math.max(
                ...PERIODS.map((p) =>
                  Math.max(
                    timing.goalsByPeriod?.[p]?.count ?? 0,
                    timing.goalsConcededByPeriod?.[p]?.count ?? 0,
                  ),
                ),
                1,
              );
              const scoredH = Math.max(
                (scored / maxVal) * 100,
                scored > 0 ? 15 : 4,
              );
              const concededH = Math.max(
                (conceded / maxVal) * 100,
                conceded > 0 ? 15 : 4,
              );

              return (
                <div
                  key={period}
                  className="flex flex-col items-center gap-1 h-full justify-end"
                >
                  <div className="flex gap-0.5 items-end flex-1 w-full justify-center">
                    <div
                      className="w-3.5 bg-emerald-500/70 rounded-t transition-all relative group"
                      style={{ height: `${scoredH}%` }}
                    >
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-emerald-400 opacity-0 group-hover:opacity-100">
                        {scored}
                      </span>
                    </div>
                    <div
                      className="w-3.5 bg-red-500/50 rounded-t transition-all relative group"
                      style={{ height: `${concededH}%` }}
                    >
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-red-400 opacity-0 group-hover:opacity-100">
                        {conceded}
                      </span>
                    </div>
                  </div>
                  <span className="text-[8px] text-white/50 font-mono leading-none whitespace-nowrap">
                    {period}'
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-white/60">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500/70 rounded-sm" /> A favor
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500/50 rounded-sm" /> En contra
            </span>
          </div>
        </div>
      )}

      {/* ══════ Shots Breakdown ══════ */}
      {attack.shots && attack.shots.total > 0 && (
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-orange-400 mb-3">
            <Zap size={16} />
            <h4 className="text-xs font-bold uppercase tracking-widest">
              Distribución de tiros
            </h4>
          </div>
          <ShotBar shots={attack.shots} />
        </div>
      )}
    </m.div>
  );
}

// ═══════ Sub-components ═══════

function KpiBox({ label, value, sublabel, color = "text-white" }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 text-center">
      <span className={`text-xl font-black block ${color}`}>{value}</span>
      <span className="text-[9px] text-white/50 font-bold uppercase tracking-widest block leading-tight">
        {sublabel || label}
      </span>
    </div>
  );
}

function StatRow({ label, value, detail }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-b-0">
      <span className="text-white/50 text-xs">{label}</span>
      <div className="text-right">
        <span className="font-bold text-white text-sm">{value ?? "—"}</span>
        {detail && (
          <p className="text-[9px] text-white/50 leading-tight">{detail}</p>
        )}
      </div>
    </div>
  );
}

function ShotBar({ shots }) {
  const total = shots.total || 1;
  const onTarget = shots.on_target || 0;
  const offTarget = shots.off_target || 0;
  const blocked = shots.blocked || 0;

  return (
    <div className="space-y-2">
      <div className="flex h-6 rounded-full overflow-hidden bg-black/30">
        <div
          className="bg-emerald-500 transition-all flex items-center justify-center"
          style={{ width: `${(onTarget / total) * 100}%` }}
        >
          <span className="text-[9px] font-bold text-white/90">{onTarget}</span>
        </div>
        <div
          className="bg-amber-500/70 transition-all flex items-center justify-center"
          style={{ width: `${(offTarget / total) * 100}%` }}
        >
          <span className="text-[9px] font-bold text-white/90">
            {offTarget}
          </span>
        </div>
        {blocked > 0 && (
          <div
            className="bg-white/20 transition-all flex items-center justify-center"
            style={{ width: `${(blocked / total) * 100}%` }}
          >
            <span className="text-[9px] font-bold text-white/60">
              {blocked}
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between text-[9px] text-white/60">
        <span>Al arco ({onTarget})</span>
        <span>Afuera ({offTarget})</span>
        {blocked > 0 && <span>Bloqueados ({blocked})</span>}
      </div>
      {shots.inside_box !== undefined && (
        <div className="flex justify-between text-[10px] text-white/50 border-t border-white/5 pt-1.5">
          <span>Dentro del área: {shots.inside_box}</span>
          <span>Fuera del área: {shots.outside_box}</span>
        </div>
      )}
    </div>
  );
}
