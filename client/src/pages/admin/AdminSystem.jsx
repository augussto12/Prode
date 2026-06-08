import React, { useState, useEffect, useCallback } from "react";
import { m } from "framer-motion";
import { Trophy, Save, Calculator, ChevronDown, Trash2, RefreshCw, Database, Loader2, CheckCircle, AlertCircle, Clock, Zap, Info, Globe, Play, Eye, Medal } from "lucide-react";
import api from "../../services/api";
import useToastStore from "../../store/toastStore";
import useCompetitionStore from "../../store/competitionStore";
import { tTeamName } from "../../utils/translations";

export default function AdminSystem({ tab, scoringConfig, onConfigUpdate, fetchCompetitions }) {
  return (
    <>
      {tab === "scoring" && scoringConfig && (
        <div className="space-y-6">
          <ResultScoringConfigEditor config={scoringConfig} onUpdate={onConfigUpdate} />
          <OutrightResultAdmin />
        </div>
      )}
      {tab === "sync" && (
        <SyncPanel onSyncComplete={() => { onConfigUpdate(); fetchCompetitions(); }} />
      )}
      {/* [OCULTADO] Sportmonks Panel — No se usa por ahora
      {tab === "sportmonks" && <SportmonksPanel />}
      */}
    </>
  );
}

function ResultScoringConfigEditor({ config, onUpdate }) {
  const [form, setForm] = useState({
    exactScore: config.exactScore,
    correctWinner: config.correctWinner,
    champion: config.champion ?? 10,
    runnerUp: config.runnerUp ?? 7,
    topScorer: config.topScorer ?? 5,
    goldenGlove: config.goldenGlove ?? 5,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/scoring/config", {
        exactScore: Number(form.exactScore),
        correctWinner: Number(form.correctWinner),
        champion: Number(form.champion),
        runnerUp: Number(form.runnerUp),
        topScorer: Number(form.topScorer),
        goldenGlove: Number(form.goldenGlove),
      });
      useToastStore
        .getState()
        .addToast({ type: "success", message: "Configuracion guardada" });
      onUpdate();
    } catch (err) {
      useToastStore
        .getState()
        .addToast({ type: "error", message: "Error al guardar configuracion" });
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    {
      key: "exactScore",
      label: "Resultado exacto",
      desc: "Acertar los goles de ambos equipos.",
      color: "emerald",
    },
    {
      key: "correctWinner",
      label: "Ganador o empate",
      desc: "Acertar el signo del partido sin importar los goles exactos.",
      color: "blue",
    },
    {
      key: "champion",
      label: "Campeon",
      desc: "Acertar quien levanta la copa al final del Mundial.",
      color: "amber",
    },
    {
      key: "runnerUp",
      label: "Subcampeon",
      desc: "Acertar el finalista que termina segundo.",
      color: "violet",
    },
    {
      key: "topScorer",
      label: "Goleador",
      desc: "Acertar el ganador de la bota de oro.",
      color: "emerald",
    },
    {
      key: "goldenGlove",
      label: "Guante de oro",
      desc: "Acertar el arquero ganador del premio.",
      color: "blue",
    },
  ];

  const colorMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-indigo-500/20">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
              Scoring de resultado
            </h3>
            <p className="text-xs sm:text-sm text-white/50">
              Solo se puntua resultado exacto o ganador/empate. El comodin x2
              duplica esos puntos y se puede usar en 3 partidos por competencia.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {form.exactScore}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-1">
            Exacto
          </div>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-400">
            {form.correctWinner}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-1">
            Ganador/empate
          </div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-400">
            {form.exactScore * 2}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-1">
            Exacto con x2
          </div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-400">
            {form.champion}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-1">
            Campeon
          </div>
        </div>
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-violet-400">
            {form.runnerUp}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-1">
            Subcampeon
          </div>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-400">
            {Number(form.topScorer) + Number(form.goldenGlove)}
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 mt-1">
            Premios jugadores
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <h3 className="text-sm sm:text-lg font-semibold text-white mb-4">
          Puntos activos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {fields.map(({ key, label, desc, color }) => (
            <div
              key={key}
              className={`rounded-xl p-3 sm:p-4 border ${colorMap[color]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base text-white font-semibold">
                    {label}
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/60 mt-1">
                    {desc}
                  </p>
                </div>
                <div className="shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: Number(e.target.value) })
                    }
                    className="w-14 sm:w-16 h-10 sm:h-12 text-center bg-black/30 border border-white/20 rounded-xl text-white text-lg sm:text-xl font-black focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="text-[9px] text-center text-white/50 mt-1">
                    pts
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm cursor-pointer border-none hover:opacity-90 disabled:opacity-50 shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
        }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? "Guardando..." : "Guardar configuracion"}
      </button>
    </div>
  );
}

function ScoringConfigEditor({ config, onUpdate }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);

  const activeFields = [
    {
      key: "exactScore",
      label: "Resultado Exacto",
      desc: "Acertar los goles de ambos equipos (ej: 2-1)",
      example: "Si predecís 2-1 y el resultado es 2-1",
      icon: "🎯",
      color: "emerald",
    },
    {
      key: "correctWinner",
      label: "Ganador Correcto",
      desc: "Acertar quién gana o si empatan (sin importar goles)",
      example: "Si predecís 3-0 y el resultado es 1-0 (ambos ganan Local)",
      note: "Mutuamente excluyente con Resultado Exacto — solo suma uno u otro",
      icon: "✅",
      color: "blue",
    },
    {
      key: "moreShots",
      label: "Más Remates al Arco",
      desc: "Acertar qué equipo tuvo más remates al arco (shots on goal)",
      example:
        'Si elegís "Local" y el Local tuvo 8 remates al arco vs 3 del Visitante',
      icon: "🔫",
      color: "violet",
    },
    {
      key: "moreCorners",
      label: "Más Córners",
      desc: "Acertar qué equipo sacó más córners",
      example: 'Si elegís "Visitante" y el Visitante tuvo 7 córners vs 3',
      icon: "🚩",
      color: "amber",
    },
    {
      key: "morePossession",
      label: "Posesión (% de Pelota)",
      desc: "Acertar qué equipo finalizará con más Posesión (0pts lo desactiva)",
      example:
        "Si gana Local el partido pero Visitante tuvo el 60% de posesión",
      icon: "⚽",
      color: "emerald",
    },
    {
      key: "moreFouls",
      label: "Faltas Cometidas",
      desc: "Acertar qué equipo hizo más faltas (0pts lo desactiva)",
      example: "El que mas faltas marque",
      icon: "🦵",
      color: "blue",
    },
    {
      key: "moreCards",
      label: "Tarjetas (Amarillas+Rojas)",
      desc: "Acertar qué equipo acumula más tarjetas en el partido (0pts lo desactiva)",
      example: "Si elegís Equipos, sumamos las amonestaciones de cada uno",
      icon: "🟨",
      color: "amber",
    },
    {
      key: "moreOffsides",
      label: "Fueras de Juego",
      desc: "Acertar qué equipo quedará atrapado más veces en fuera de juego",
      example: "Si ambos tienen 0 es EQUAL",
      icon: "🏁",
      color: "violet",
    },
    {
      key: "moreSaves",
      label: "Atajadas del Arquero",
      desc: "Acertar qué arquero tuvo que realizar más atajadas que el adversario",
      example: "",
      icon: "🧤",
      color: "emerald",
    },
  ];

  const legacyFields = [
    {
      key: "doubleChance",
      label: "Doble Oportunidad",
      desc: "Legacy — No se usa actualmente en el cálculo",
    },
    {
      key: "btts",
      label: "Ambos Anotan (BTTS)",
      desc: "Legacy — No se usa actualmente en el cálculo",
    },
    {
      key: "overUnder",
      label: "Más/Menos 2.5",
      desc: "Legacy — No se usa actualmente en el cálculo",
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/scoring/config", {
        exactScore: Number(form.exactScore),
        correctWinner: Number(form.correctWinner),
      });
      useToastStore
        .getState()
        .addToast({ type: "success", message: "Configuración guardada ✅" });
      onUpdate();
    } catch (err) {
      useToastStore
        .getState()
        .addToast({ type: "error", message: "Error al guardar configuración" });
    } finally {
      setSaving(false);
    }
  };

  // Calculate example totals for preview
  const exampleExact = form.exactScore;
  const exampleWinner = form.correctWinner;
  const exampleExactJoker = exampleExact * 2;

  const colorMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Info Banner */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-indigo-500/20">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
              ¿Cómo funciona el scoring?
            </h3>
            <ul className="text-xs sm:text-sm text-white/50 space-y-1">
              <li>
                • Si acertás el{" "}
                <strong className="text-emerald-400">resultado exacto</strong>{" "}
                sumás esos puntos. Si no, pero acertás el{" "}
                <strong className="text-blue-400">ganador</strong>, sumás esos
                otros.
              </li>
              <li>
                • <strong className="text-violet-400">Remates al Arco</strong> y{" "}
                <strong className="text-amber-400">Córners</strong> son
                independientes — se suman siempre.
              </li>
              <li>
                • El <strong className="text-amber-300">Comodín x2</strong>{" "}
                multiplica TODOS los puntos del partido ×2.
              </li>
              <li>
                • Si un mercado tiene <strong>0 pts</strong>, no suma (pero
                sigue disponible para predecir).
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Vista previa — Máximos posibles
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">
              {exampleExact}
            </div>
            <div className="text-[10px] sm:text-xs text-white/60 mt-1">
              Exacto + Remates + Córners
            </div>
            <div className="text-[9px] text-white/40 mt-0.5">
              Mejor caso sin comodín
            </div>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-black text-blue-400">
              {exampleWinner}
            </div>
            <div className="text-[10px] sm:text-xs text-white/60 mt-1">
              Ganador + Remates + Córners
            </div>
            <div className="text-[9px] text-white/40 mt-0.5">
              Caso parcial sin comodín
            </div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-black text-amber-400">
              {exampleExactJoker}
            </div>
            <div className="text-[10px] sm:text-xs text-white/60 mt-1">
              Todo perfecto + Comodín x2
            </div>
            <div className="text-[9px] text-white/40 mt-0.5">
              Máximo absoluto
            </div>
          </div>
        </div>
      </div>

      {/* Active Scoring Fields */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <h3 className="text-sm sm:text-lg font-semibold text-white mb-4">
          Configuración de Puntos Activos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {activeFields.slice(0, 2).map(
            ({ key, label, desc, example, note, icon, color }) => (
              <div
                key={key}
                className={`rounded-xl p-3 sm:p-4 border ${colorMap[color]}`}
                style={{ background: undefined }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{icon}</span>
                      <span className="text-sm sm:text-base text-white font-semibold">
                        {label}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-white/60 mb-1.5">
                      {desc}
                    </p>
                    <p className="text-[10px] sm:text-xs text-white/40 italic">
                      Ej: {example}
                    </p>
                    {note && (
                      <p className="text-[10px] text-amber-400/60 mt-1.5 flex items-start gap-1">
                        <Zap size={10} className="shrink-0 mt-0.5" /> {note}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: Number(e.target.value) })
                      }
                      className="w-14 sm:w-16 h-10 sm:h-12 text-center bg-black/30 border border-white/20 rounded-xl text-white text-lg sm:text-xl font-black focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="text-[9px] text-center text-white/50 mt-1">
                      pts
                    </div>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Legacy Fields (collapsed) */}
      {Boolean(import.meta.env.VITE_SHOW_LEGACY_PRODE_MARKETS) && <details className="glass-card rounded-xl sm:rounded-2xl overflow-hidden">
        <summary className="p-4 sm:p-5 cursor-pointer text-xs sm:text-sm text-white/60 font-medium hover:text-white/60 transition-colors flex items-center gap-2">
          <ChevronDown size={14} /> Campos Legacy (no activos en el cálculo)
        </summary>
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-white/5 pt-3">
          <p className="text-[10px] sm:text-xs text-white/40">
            Estos campos existen en la BD pero no se utilizan en el cálculo
            actual. Si los activás en el código de scoring, empezarían a
            puntuar.
          </p>
          {legacyFields.map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between bg-white/[0.02] rounded-xl p-3 opacity-50"
            >
              <div>
                <div className="text-xs sm:text-sm text-white/50 font-medium">
                  {label}
                </div>
                <div className="text-[10px] sm:text-xs text-white/40">
                  {desc}
                </div>
              </div>
              <input
                type="number"
                min="0"
                value={form[key]}
                onChange={(e) =>
                  setForm({ ...form, [key]: Number(e.target.value) })
                }
                className="w-12 sm:w-14 h-8 sm:h-9 text-center bg-white/5 border border-white/10 rounded-lg text-white/50 text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          ))}
        </div>
      </details>}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm cursor-pointer border-none hover:opacity-90 disabled:opacity-50 shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
        }}
      >
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Save size={16} />
        )}
        {saving ? "Guardando..." : "Guardar Configuración"}
      </button>
    </div>
  );
}


function OutrightResultAdmin() {
  const activeCompetition = useCompetitionStore((state) => state.activeCompetition);
  const competitions = useCompetitionStore((state) => state.competitions);
  const [competitionId, setCompetitionId] = useState(activeCompetition?.id ? String(activeCompetition.id) : "");
  const [teams, setTeams] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [goalkeepers, setGoalkeepers] = useState([]);
  const [form, setForm] = useState({
    lockAt: "",
    championTeamId: "",
    runnerUpTeamId: "",
    topScorerTeamId: "",
    topScorerId: "",
    goldenGloveTeamId: "",
    goldenGloveId: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [syncingOptions, setSyncingOptions] = useState(false);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [optionsRes, resultRes] = await Promise.all([
        api.get(`/outrights/options?competitionId=${competitionId}`),
        api.get(`/admin/outrights/result?competitionId=${competitionId}`),
      ]);
      setTeams(optionsRes.data?.teams || []);
      const result = resultRes.data?.result;
      const defaultLockAt = result?.lockAt || resultRes.data?.lockAt || optionsRes.data?.lockAt || null;
      setForm({
        lockAt: toDateTimeLocal(defaultLockAt),
        championTeamId: result?.championTeamId ? String(result.championTeamId) : "",
        runnerUpTeamId: result?.runnerUpTeamId ? String(result.runnerUpTeamId) : "",
        topScorerTeamId: result?.topScorer?.teamId ? String(result.topScorer.teamId) : "",
        topScorerId: result?.topScorerId ? String(result.topScorerId) : "",
        goldenGloveTeamId: result?.goldenGlove?.teamId ? String(result.goldenGlove.teamId) : "",
        goldenGloveId: result?.goldenGloveId ? String(result.goldenGloveId) : "",
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al cargar premios finales",
      });
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  const loadPlayers = useCallback(async (type, teamId) => {
    try {
      const positionParam = type === "goldenGlove" ? "&position=GK" : "";
      const { data } = await api.get(
        `/outrights/players?competitionId=${competitionId}&teamId=${teamId}${positionParam}`,
      );
      if (type === "goldenGlove") setGoalkeepers(data || []);
      else setTopScorers(data || []);
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: "Error al cargar jugadores" });
    }
  }, [competitionId]);

  useEffect(() => {
    if (!competitionId && activeCompetition?.id) {
      setCompetitionId(String(activeCompetition.id));
    }
  }, [activeCompetition?.id, competitionId]);

  useEffect(() => {
    if (competitionId) loadAdminData();
  }, [competitionId, loadAdminData]);

  useEffect(() => {
    if (form.topScorerTeamId) loadPlayers("topScorer", form.topScorerTeamId);
    else setTopScorers([]);
  }, [form.topScorerTeamId, loadPlayers]);

  useEffect(() => {
    if (form.goldenGloveTeamId) loadPlayers("goldenGlove", form.goldenGloveTeamId);
    else setGoalkeepers([]);
  }, [form.goldenGloveTeamId, loadPlayers]);

  const handleTeamChange = (field, value) => {
    const reset =
      field === "topScorerTeamId"
        ? { topScorerId: "" }
        : field === "goldenGloveTeamId"
          ? { goldenGloveId: "" }
          : {};
    setForm((prev) => ({ ...prev, [field]: value, ...reset }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/outrights/result", {
        competitionId: Number(competitionId),
        lockAt: form.lockAt ? new Date(form.lockAt).toISOString() : null,
        championTeamId: toNumberOrNull(form.championTeamId),
        runnerUpTeamId: toNumberOrNull(form.runnerUpTeamId),
        topScorerId: toNumberOrNull(form.topScorerId),
        goldenGloveId: toNumberOrNull(form.goldenGloveId),
      });
      useToastStore.getState().addToast({ type: "success", message: "Premios finales guardados" });
      await loadAdminData();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al guardar premios finales",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const { data } = await api.post("/admin/outrights/calculate", {
        competitionId: Number(competitionId),
      });
      useToastStore.getState().addToast({
        type: "success",
        message: data?.message || "Premios finales calculados",
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al calcular premios finales",
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleSyncOptions = async () => {
    setSyncingOptions(true);
    try {
      const { data } = await api.post("/admin/outrights/sync-options", {
        competitionId: Number(competitionId),
      });
      const errorText = data?.errors?.length ? ` (${data.errors.length} con error)` : "";
      useToastStore.getState().addToast({
        type: "success",
        message: `Selecciones: ${data?.teams?.total ?? 0}. Jugadores: ${data?.players?.total ?? 0}${errorText}`,
      });
      await loadAdminData();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al sincronizar selecciones y jugadores",
      });
    } finally {
      setSyncingOptions(false);
    }
  };

  return (
    <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
          <Medal size={20} />
        </div>
        <div>
          <h3 className="text-sm sm:text-lg font-semibold text-white">Ganadores finales</h3>
          <p className="text-xs sm:text-sm text-white/50">
            Carga los resultados oficiales y calcula los puntos de campeon, subcampeon, goleador y guante de oro.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60 text-sm py-4">
          <Loader2 size={16} className="animate-spin" /> Cargando premios...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminSelect
              label="Competencia"
              value={competitionId}
              onChange={setCompetitionId}
              options={competitions}
              placeholder="Seleccionar competencia"
            />
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-white/50 font-bold mb-2">
                Bloqueo de predicciones
              </span>
              <input
                type="datetime-local"
                value={form.lockAt}
                onChange={(e) => setForm((prev) => ({ ...prev, lockAt: e.target.value }))}
                className="w-full border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-amber-500/60"
                style={{ background: "var(--bg-end-color, #111827)" }}
              />
            </label>
            <AdminSelect
              label="Campeon oficial"
              value={form.championTeamId}
              onChange={(value) => handleTeamChange("championTeamId", value)}
              options={teams}
              placeholder="Seleccionar campeon"
            />
            <AdminSelect
              label="Subcampeon oficial"
              value={form.runnerUpTeamId}
              onChange={(value) => handleTeamChange("runnerUpTeamId", value)}
              options={teams}
              placeholder="Seleccionar subcampeon"
            />
            <AdminSelect
              label="Seleccion del goleador"
              value={form.topScorerTeamId}
              onChange={(value) => handleTeamChange("topScorerTeamId", value)}
              options={teams}
              placeholder="Seleccionar seleccion"
            />
            <AdminSelect
              label="Goleador oficial"
              value={form.topScorerId}
              onChange={(value) => setForm((prev) => ({ ...prev, topScorerId: value }))}
              options={topScorers}
              placeholder="Seleccionar jugador"
              disabled={!form.topScorerTeamId}
            />
            <AdminSelect
              label="Seleccion del guante de oro"
              value={form.goldenGloveTeamId}
              onChange={(value) => handleTeamChange("goldenGloveTeamId", value)}
              options={teams}
              placeholder="Seleccionar seleccion"
            />
            <AdminSelect
              label="Guante de oro oficial"
              value={form.goldenGloveId}
              onChange={(value) => setForm((prev) => ({ ...prev, goldenGloveId: value }))}
              options={goalkeepers}
              placeholder="Seleccionar arquero"
              disabled={!form.goldenGloveTeamId}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSyncOptions}
              disabled={syncingOptions || !competitionId}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {syncingOptions ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncingOptions ? "Sincronizando..." : "Sincronizar selecciones y jugadores"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !competitionId}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Guardando..." : "Guardar ganadores"}
            </button>
            <button
              onClick={handleCalculate}
              disabled={calculating || !competitionId}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {calculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
              {calculating ? "Calculando..." : "Calcular premios finales"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AdminSelect({ label, value, onChange, options, placeholder, disabled }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-white/50 font-bold mb-2">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-amber-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--bg-end-color, #111827)" }}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.displayName || tTeamName(item.name)}
          </option>
        ))}
      </select>
    </label>
  );
}

function toNumberOrNull(value) {
  return value ? Number(value) : null;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function SyncPanel({ onSyncComplete }) {
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  const [apiStatus, setApiStatus] = useState(null);
  const [teams, setTeams] = useState([]);
  const [leagueId, setLeagueId] = useState("1");
  const [season, setSeason] = useState("2022");
  const activeCompetition = useCompetitionStore(
    (state) => state.activeCompetition,
  );

  useEffect(() => {
    loadApiStatus();
    loadTeams();
  }, []);

  const loadApiStatus = async () => {
    try {
      const { data } = await api.get("/admin/sync/status");
      setApiStatus(data);
    } catch (err) {
      console.error("Error loading API status:", err);
    }
  };

  const loadTeams = async () => {
    try {
      const { data } = await api.get("/matches/teams");
      setTeams(data);
    } catch (err) {
      console.error(err);
    }
  };

  const runSync = async (action, body = {}) => {
    const syncBody = { ...body };
    if (["teams", "fixtures", "results"].includes(action)) {
      syncBody.leagueId = Number(leagueId);
      syncBody.season = Number(season);
    }
    if (["squads"].includes(action) && activeCompetition?.id) {
      syncBody.competitionId = activeCompetition.id;
    }

    setLoading((prev) => ({ ...prev, [action]: true }));
    setResults((prev) => ({ ...prev, [action]: null }));
    try {
      const { data } = await api.post(`/admin/sync/${action}`, syncBody);
      setResults((prev) => ({ ...prev, [action]: { success: true, data } }));
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: data.message || "Sincronizado ✅",
        });
      loadApiStatus();
      if (["teams", "fixtures", "results"].includes(action)) onSyncComplete();
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [action]: {
          success: false,
          error: err.response?.data?.error || err.message,
        },
      }));
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error en sync",
        });
    } finally {
      setLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  const syncActions = [
    {
      id: "teams",
      label: "Sync Equipos",
      desc: "Selecciones con logos y banderas",
      icon: "🏟️",
      callsUsed: 1,
    },
    {
      id: "fixtures",
      label: "Sync Partidos",
      desc: "Calendario, estadios y resultados",
      icon: "⚽",
      callsUsed: 1,
    },
    {
      id: "results",
      label: "Actualizar Resultados",
      desc: "Goles y estados de partidos",
      icon: "📊",
      callsUsed: 1,
    },
  ];

  return (
    <div className="space-y-4">
      {/* API Status Card */}
      {apiStatus && (
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Estado de API
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-white">
                {apiStatus.requests?.current ?? "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
                Requests hoy
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-white">
                {apiStatus.requests?.limit_day ?? "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
                Límite diario
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                {apiStatus.requests?.limit_day && apiStatus.requests?.current
                  ? apiStatus.requests.limit_day - apiStatus.requests.current
                  : "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
                Restantes
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-2.5 sm:p-3 text-center">
              <div className="text-xs sm:text-sm font-medium text-white/70">
                {apiStatus.subscription?.plan ?? "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
                Plan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* League/Season Selector */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Liga & Temporada
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-[10px] sm:text-xs text-white/60 mb-1">
              League ID (API-Football)
            </label>
            <input
              type="number"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ej: 1 (Mundial)"
            />
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs text-white/60 mb-1">
              Temporada
            </label>
            <input
              type="number"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ej: 2026"
            />
          </div>
          {activeCompetition && (
            <div className="flex items-end">
              <div className="bg-white/[0.03] rounded-lg px-3 py-2 flex items-center gap-2 w-full">
                {activeCompetition.logo && (
                  <img                     src={activeCompetition.logo}
                    alt=""
                    className="w-5 h-5 object-contain shrink-0"
                    loading="lazy"
                    decoding="async"
                    width={20} height={20}
  onError={(e) => {
                      e.target.src = "/placeholder-team.svg";
                    }}
                  />
                )}
                <span className="text-xs sm:text-sm text-white/70 truncate">
                  Activa:{" "}
                  <strong className="text-white">
                    {activeCompetition.name}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
        <p className="text-[10px] sm:text-xs text-white/60 mt-2">
          IDs comunes: 1=Mundial, 128=Liga Argentina, 13=Libertadores,
          2=Champions
        </p>
      </div>

      {/* Sync Actions */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Sincronización
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {syncActions.map((action) => (
            <div
              key={action.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 bg-white/[0.03] rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">{action.icon}</span>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-white">
                    {action.label}
                  </div>
                  <div className="text-[10px] sm:text-xs text-white/60">
                    {action.desc} • {action.callsUsed} call
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-8 sm:ml-0">
                {results[action.id] &&
                  (results[action.id].success ? (
                    <CheckCircle size={14} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={14} className="text-red-400" />
                  ))}
                <button
                  onClick={() => runSync(action.id)}
                  disabled={loading[action.id]}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
                  }}
                >
                  {loading[action.id] ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {loading[action.id] ? "Sync..." : "Sync"}
                </button>
              </div>
            </div>
          ))}

          {/* Squad sync */}
          <div className="bg-white/[0.03] rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">👤</span>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-white">
                    Sync Planteles
                  </div>
                  <div className="text-[10px] sm:text-xs text-white/60">
                    Jugadores de los equipos • 1 call/equipo
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-8 sm:ml-0">
              <button
                onClick={() => runSync("squads", { batchSize: 10 })}
                disabled={loading.squads}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
                }}
              >
                {loading.squads ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {loading.squads ? "Sincronizando..." : "Sync 10 equipos"}
              </button>
              {results.squads?.success && (
                <span className="text-[10px] sm:text-xs text-emerald-400">
                  {results.squads.data.message}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results detail */}
      {Object.entries(results).filter(([, r]) => r?.success && r.data).length >
        0 && (
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Últimos resultados
          </h3>
          <div className="space-y-2 text-xs sm:text-sm text-white/70">
            {Object.entries(results).map(
              ([key, r]) =>
                r?.success && (
                  <div
                    key={key}
                    className="flex items-start gap-2 bg-white/[0.03] rounded-lg p-2.5 sm:p-3"
                  >
                    <CheckCircle
                      size={14}
                      className="text-emerald-400 shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-white">{key}: </span>
                      <span className="break-all text-[10px] sm:text-xs">
                        {JSON.stringify(r.data).substring(0, 120)}...
                      </span>
                    </div>
                  </div>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function SportmonksPanel() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState({});
  const [leagues, setLeagues] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [liveFixtures, setLiveFixtures] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);

  useEffect(() => {
    loadSyncStatus();
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const loadSyncStatus = async () => {
    try {
      const { data } = await api.get("/admin/sportmonks/sync-status");
      setSyncStatus(data);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerInitialSync = async () => {
    setLoading((prev) => ({ ...prev, initial: true }));
    try {
      await api.post("/admin/sportmonks/sync-initial");
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: "Sync inicial lanzado en background 🚀",
        });
      // Poll status every 3s
      const interval = setInterval(async () => {
        try {
          const { data } = await api.get("/admin/sportmonks/sync-status");
          setSyncStatus(data);
          if (!data.isRunning) {
            clearInterval(interval);
            setPollInterval(null);
            setLoading((prev) => ({ ...prev, initial: false }));
            useToastStore.getState().addToast({
              type: data.error ? "error" : "success",
              message: data.error || "Sync completado ✅",
            });
          }
        } catch (e) {
          /* ignore */
        }
      }, 3000);
      setPollInterval(interval);
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al iniciar sync",
        });
      setLoading((prev) => ({ ...prev, initial: false }));
    }
  };

  const triggerFixturesSync = async () => {
    setLoading((prev) => ({ ...prev, fixtures: true }));
    try {
      const { data } = await api.post("/admin/sportmonks/sync-fixtures");
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: data.message || "Fixtures sincronizados ✅",
        });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error",
        });
    } finally {
      setLoading((prev) => ({ ...prev, fixtures: false }));
    }
  };

  const triggerStaticSync = async () => {
    setLoading((prev) => ({ ...prev, static: true }));
    try {
      const { data } = await api.post("/admin/sportmonks/sync-static");
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: data.message || "Datos estáticos sincronizados ✅",
        });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error",
        });
    } finally {
      setLoading((prev) => ({ ...prev, static: false }));
    }
  };

  const triggerRoundsSync = async () => {
    setLoading((prev) => ({ ...prev, rounds: true }));
    try {
      const { data } = await api.post("/admin/sportmonks/sync-rounds", {}, { timeout: 60000 });
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: data.message || "Rounds sincronizadas ✅",
        });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al sincronizar rounds",
        });
    } finally {
      setLoading((prev) => ({ ...prev, rounds: false }));
    }
  };

  const loadLeagues = async () => {
    setLoading((prev) => ({ ...prev, viewLeagues: true }));
    try {
      const { data } = await api.get("/sportmonks/leagues");
      setLeagues(data);
    } catch (err) {
      useToastStore
        .getState()
        .addToast({ type: "error", message: "Error al cargar ligas" });
    } finally {
      setLoading((prev) => ({ ...prev, viewLeagues: false }));
    }
  };

  const loadTodayFixtures = async () => {
    setLoading((prev) => ({ ...prev, viewFixtures: true }));
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const { data } = await api.get(`/sportmonks/fixtures/date/${today}`);
      setFixtures(data);
    } catch (err) {
      useToastStore
        .getState()
        .addToast({ type: "error", message: "Error al cargar fixtures" });
    } finally {
      setLoading((prev) => ({ ...prev, viewFixtures: false }));
    }
  };

  const loadLiveFixtures = async () => {
    setLoading((prev) => ({ ...prev, viewLive: true }));
    try {
      const { data } = await api.get("/sportmonks/fixtures/live");
      setLiveFixtures(data);
    } catch (err) {
      useToastStore
        .getState()
        .addToast({ type: "error", message: "Error al cargar en vivo" });
    } finally {
      setLoading((prev) => ({ ...prev, viewLive: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Sync Status Card */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider">
            Estado de Sincronización
          </h3>
          <button
            onClick={loadSyncStatus}
            className="text-xs text-white/60 hover:text-white/70 bg-transparent border-none cursor-pointer"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {syncStatus ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div
                className={`text-lg font-bold ${syncStatus.isRunning ? "text-amber-400" : syncStatus.error ? "text-red-400" : syncStatus.completedAt ? "text-emerald-400" : "text-white/50"}`}
              >
                {syncStatus.isRunning
                  ? "⏳"
                  : syncStatus.error
                    ? "❌"
                    : syncStatus.completedAt
                      ? "✅"
                      : "—"}
              </div>
              <div className="text-[10px] text-white/60 mt-1">Estado</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">
                {syncStatus.results?.teams || 0}
              </div>
              <div className="text-[10px] text-white/60 mt-1">Equipos</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">
                {syncStatus.results?.players || 0}
              </div>
              <div className="text-[10px] text-white/60 mt-1">Jugadores</div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">
                {syncStatus.results?.fixtures || 0}
              </div>
              <div className="text-[10px] text-white/60 mt-1">Fixtures</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-white/60">Cargando estado...</div>
        )}

        {syncStatus?.isRunning && (
          <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <Loader2 size={14} className="text-amber-400 animate-spin" />
            <span className="text-xs text-amber-300">
              {syncStatus.progress || "Procesando..."}
            </span>
          </div>
        )}

        {syncStatus?.error && (
          <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-300">{syncStatus.error}</span>
          </div>
        )}
      </div>

      {/* Sync Actions */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Acciones de Sync
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {/* Initial Sync */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.03] rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚀</span>
              <div>
                <div className="text-xs sm:text-sm font-medium text-white">
                  Sync Inicial Completo
                </div>
                <div className="text-[10px] sm:text-xs text-white/60">
                  Ligas → Equipos → Planteles → Fixtures (puede tardar varios
                  minutos)
                </div>
              </div>
            </div>
            <button
              onClick={triggerInitialSync}
              disabled={loading.initial || syncStatus?.isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading.initial ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              {loading.initial ? "Ejecutando..." : "Ejecutar"}
            </button>
          </div>

          {/* Fixtures Sync */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.03] rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <div className="text-xs sm:text-sm font-medium text-white">
                  Sync Fixtures
                </div>
                <div className="text-[10px] sm:text-xs text-white/60">
                  Hoy + mañana + pasado mañana (cron cada 3h)
                </div>
              </div>
            </div>
            <button
              onClick={triggerFixturesSync}
              disabled={loading.fixtures}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
              }}
            >
              {loading.fixtures ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {loading.fixtures ? "Sync..." : "Sync ahora"}
            </button>
          </div>

          {/* Static Sync */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.03] rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <div className="text-xs sm:text-sm font-medium text-white">
                  Sync Estático
                </div>
                <div className="text-[10px] sm:text-xs text-white/60">
                  Equipos + planteles nuevos (cron diario 3AM)
                </div>
              </div>
            </div>
            <button
              onClick={triggerStaticSync}
              disabled={loading.static}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
              }}
            >
              {loading.static ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {loading.static ? "Sync..." : "Sync ahora"}
            </button>
          </div>

          {/* Rounds Sync */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.03] rounded-xl p-3 sm:p-4 mt-2 sm:mt-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📆</span>
              <div>
                <div className="text-xs sm:text-sm font-medium text-white">
                  Sync Rounds (Jornadas)
                </div>
                <div className="text-[10px] sm:text-xs text-white/60">
                  Fechas/jornadas de la temporada actual (cron Semanal Lunes 4AM)
                </div>
              </div>
            </div>
            <button
              onClick={triggerRoundsSync}
              disabled={loading.rounds}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer border-none text-white hover:opacity-90 disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
              }}
            >
              {loading.rounds ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {loading.rounds ? "Sync..." : "Sync ahora"}
            </button>
          </div>
        </div>
      </div>

      {/* Data Explorer */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Explorar Datos Sportmonks
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={loadLeagues}
            disabled={loading.viewLeagues}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent disabled:opacity-40"
          >
            {loading.viewLeagues ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Eye size={12} />
            )}
            Ver Ligas
          </button>
          <button
            onClick={loadTodayFixtures}
            disabled={loading.viewFixtures}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent disabled:opacity-40"
          >
            {loading.viewFixtures ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Eye size={12} />
            )}
            Fixtures de Hoy
          </button>
          <button
            onClick={loadLiveFixtures}
            disabled={loading.viewLive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent disabled:opacity-40"
          >
            {loading.viewLive ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Eye size={12} />
            )}
            En Vivo 🔴
          </button>
        </div>

        {/* Leagues */}
        {leagues && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-white/60 mb-2">
              Ligas Cubiertas ({leagues.leagueIds?.length || 0})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(leagues.leagues || []).map((league) => (
                <div
                  key={league.id}
                  className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-2.5"
                >
                  {league.image_path && (
                    <img                       src={league.image_path}
                      alt=""
                      className="w-8 h-8 object-contain"
                    loading="lazy" decoding="async" width={32} height={32} />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {league.name}
                    </div>
                    <div className="text-[10px] text-white/60">
                      ID: {league.id} • {league.country?.name || "—"}
                      {league.currentseason?.name
                        ? ` • ${league.currentseason.name}`
                        : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Fixtures */}
        {fixtures && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-white/60 mb-2">
              Fixtures de Hoy ({Array.isArray(fixtures) ? fixtures.length : 0})
            </h4>
            {Array.isArray(fixtures) && fixtures.length > 0 ? (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {fixtures.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          f.status === "live"
                            ? "bg-red-500 animate-pulse"
                            : f.status === "finished"
                              ? "bg-emerald-500"
                              : "bg-white/20"
                        }`}
                      />
                      <span className="text-xs text-white truncate">
                        {f.homeTeamId} vs {f.awayTeamId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {f.homeScore !== null && (
                        <span className="text-xs font-bold text-white">
                          {f.homeScore} - {f.awayScore}
                        </span>
                      )}
                      <span className="text-[10px] text-white/60">
                        {new Date(f.startTime).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          f.status === "live"
                            ? "bg-red-500/20 text-red-400"
                            : f.status === "finished"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/10 text-white/50"
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-white/60 py-4 text-center">
                No hay fixtures para hoy. Ejecutá el Sync de Fixtures primero.
              </div>
            )}
          </div>
        )}

        {/* Live */}
        {liveFixtures && (
          <div>
            <h4 className="text-xs font-semibold text-white/60 mb-2">
              En Vivo ({liveFixtures.total || 0})
            </h4>
            {liveFixtures.total > 0 ? (
              <div className="space-y-1.5">
                {(liveFixtures.grouped || []).map((group) => (
                  <div key={group.leagueId}>
                    <div className="text-[10px] text-white/60 mb-1">
                      Liga ID: {group.leagueId}
                    </div>
                    {group.fixtures.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-lg p-2.5"
                      >
                        <span className="text-xs text-white">
                          {f.homeTeamId} vs {f.awayTeamId}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {f.homeScore ?? "?"} - {f.awayScore ?? "?"}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-white/60 py-4 text-center">
                No hay partidos en vivo en este momento
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cron Info */}
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <h3 className="text-xs sm:text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
          Cron Jobs Activos
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              📦 <strong className="text-white/80">Static:</strong> Diario a las
              03:00 AM — equipos y planteles
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              📆 <strong className="text-white/80">Rounds:</strong> Semanal (Lunes
              04:00 AM) — todas las rondas de Sportmonks
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              📅 <strong className="text-white/80">Fixtures:</strong> Cada 3
              horas — partidos de hoy/mañana/pasado
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              🔴 <strong className="text-white/80">Live:</strong> Cada 20 seg —
              solo si hay partidos activos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

