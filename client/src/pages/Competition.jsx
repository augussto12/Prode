import { useState, useEffect } from "react";
import { Calendar, BarChart3, Lock, Trophy, BookOpen, CheckCircle2 } from "lucide-react";
import useCompetitionStore from "../store/competitionStore";
import useAuthStore from "../store/authStore";
import ProdeMatches from "../components/matches/ProdeMatches";
import OutrightPredictions from "../components/outrights/OutrightPredictions";
import { WORLD_CUP_2026_LOGO } from "../utils/worldCupLogo";

const TABS = [
  { id: "matches", label: "Partidos", icon: Calendar },
  { id: "predictions", label: "Predicciones", icon: BarChart3 },
  { id: "finals", label: "Predicciones finales", icon: Trophy },
  { id: "rules", label: "Reglamento", icon: BookOpen },
];

const RULES = [
  "Elegí el resultado de cada partido antes de que empiece.",
  "Podés cambiar tu predicción hasta 5 minutos antes del inicio.",
  "Si acertás el resultado exacto sumás más puntos.",
  "Si acertás ganador o empate, aunque no sea exacto, también sumás.",
  "Tenés 3 comodines x2 para duplicar los puntos de partidos clave.",
  "Las predicciones finales son para campeón, finalistas y premios del torneo.",
  "Una vez cerrado el partido, la predicción ya no se puede editar.",
];

export default function Competition({ hideHeader }) {
  const [tab, setTab] = useState("matches");
  const activeCompetition = useCompetitionStore(
    (state) => state.activeCompetition,
  );
  const competitions = useCompetitionStore((state) => state.competitions);
  const setActive = useCompetitionStore((state) => state.setActive);
  const user = useAuthStore((state) => state.user);

  // Fallback: si no hay competencia activa, buscar Mundial
  useEffect(() => {
    if (!activeCompetition && competitions.length > 0) {
      const worldCup = competitions.find((c) => c.externalId === 1);
      if (worldCup) {
        setActive(worldCup);
      } else {
        // Hardcode fallback si la API no devuelve nada
        setActive({
          id: 1,
          name: "Copa del Mundo 2026",
          externalId: 1,
          season: 2026,
          logo: WORLD_CUP_2026_LOGO,
        });
      }
    }
  }, [activeCompetition, competitions, setActive]);

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/90 border border-white/20 p-1.5">
            <img
              src={WORLD_CUP_2026_LOGO}
              alt=""
              className="w-full h-full object-contain"
              width={28}
              height={28}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Mi Prode</h1>
            <p className="text-white/50 text-sm">
              {activeCompetition?.name || "Hacé tus pronósticos"}
            </p>
          </div>
        </div>
      )}

      {/* Banner de login requerido para guardar */}
      {!user && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <Lock size={16} className="shrink-0" />
          <span>Iniciá sesión para guardar tus predicciones y participar del prode.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit max-w-full overflow-x-auto">
        {TABS.filter((t) => user || ["matches", "rules"].includes(t.id)).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-label={t.label}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer ${tab === t.id
              ? "bg-white/10 text-white shadow-sm"
              : "bg-transparent text-white/60 hover:text-white/60"
              }`}
          >
            <t.icon size={16} aria-hidden="true" />
            <span className={`${t.id === "finals" ? "inline" : "hidden sm:inline"} whitespace-nowrap`}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Partidos Tab — delega a ProdeMatches (incluye matches + historial) */}
      {(tab === "matches" || tab === "predictions") && (
      <ProdeMatches
        competitionId={activeCompetition?.id}
        initialTab={tab === "predictions" ? "history" : "matches"}
        showSubTabs={false}
      />
      )}

      {/* Final awards Tab */}
      {tab === "finals" && (
        <OutrightPredictions competitionId={activeCompetition?.id} />
      )}

      {tab === "rules" && (
        <div className="glass-card rounded-2xl border border-white/10 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">Reglamento del Prode</h2>
            <p className="mt-1 text-sm text-white/55">
              Una guía rápida para saber qué hacer y cómo sumar.
            </p>
          </div>

          <div className="grid gap-2">
            {RULES.map((rule) => (
              <div
                key={rule}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3"
              >
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                <span className="text-sm leading-relaxed text-white/75">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
