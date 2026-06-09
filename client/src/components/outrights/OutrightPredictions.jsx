import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Lock, Save, ShieldCheck, Trophy } from "lucide-react";
import api from "../../services/api";
import useToastStore from "../../store/toastStore";
import { tTeamName } from "../../utils/translations";

const emptyForm = {
  championTeamId: "",
  runnerUpTeamId: "",
  topScorerTeamId: "",
  topScorerId: "",
  goldenGloveTeamId: "",
  goldenGloveId: "",
};

function toSelectValue(value) {
  return value ? String(value) : "";
}

function toPayloadNumber(value) {
  return value ? Number(value) : null;
}

export default function OutrightPredictions({ competitionId }) {
  const [teams, setTeams] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [goalkeepers, setGoalkeepers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [lockInfo, setLockInfo] = useState({ locked: false, lockAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlayers = useCallback(async (type, teamId) => {
    try {
      const positionParam = type === "goldenGlove" ? "&position=GK" : "";
      const { data } = await api.get(
        `/outrights/players?competitionId=${competitionId}&teamId=${teamId}${positionParam}`,
      );
      if (type === "goldenGlove") setGoalkeepers(data || []);
      else setTopScorers(data || []);
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: "No se pudieron cargar los jugadores",
      });
    }
  }, [competitionId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [optionsRes, predictionRes] = await Promise.all([
        api.get(`/outrights/options?competitionId=${competitionId}`),
        api.get(`/outrights?competitionId=${competitionId}`),
      ]);
      setTeams(optionsRes.data?.teams || []);
      setLockInfo({
        locked: Boolean(predictionRes.data?.locked || optionsRes.data?.locked),
        lockAt: predictionRes.data?.lockAt || optionsRes.data?.lockAt || null,
      });

      const prediction = predictionRes.data?.prediction;
      if (prediction) {
        setForm({
          championTeamId: toSelectValue(prediction.championTeamId),
          runnerUpTeamId: toSelectValue(prediction.runnerUpTeamId),
          topScorerTeamId: toSelectValue(prediction.topScorerTeamId || prediction.topScorer?.teamId),
          topScorerId: toSelectValue(prediction.topScorerId),
          goldenGloveTeamId: toSelectValue(prediction.goldenGloveTeamId || prediction.goldenGlove?.teamId),
          goldenGloveId: toSelectValue(prediction.goldenGloveId),
        });
      }
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al cargar predicciones finales",
      });
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    if (competitionId) loadData();
  }, [competitionId, loadData]);

  useEffect(() => {
    if (form.topScorerTeamId) {
      loadPlayers("topScorer", form.topScorerTeamId);
    } else {
      setTopScorers([]);
    }
  }, [form.topScorerTeamId, loadPlayers]);

  useEffect(() => {
    if (form.goldenGloveTeamId) {
      loadPlayers("goldenGlove", form.goldenGloveTeamId);
    } else {
      setGoalkeepers([]);
    }
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/outrights", {
        competitionId,
        championTeamId: toPayloadNumber(form.championTeamId),
        runnerUpTeamId: toPayloadNumber(form.runnerUpTeamId),
        topScorerTeamId: toPayloadNumber(form.topScorerTeamId),
        topScorerId: toPayloadNumber(form.topScorerId),
        goldenGloveTeamId: toPayloadNumber(form.goldenGloveTeamId),
        goldenGloveId: toPayloadNumber(form.goldenGloveId),
      });
      useToastStore.getState().addToast({
        type: "success",
        message: "Predicciones finales guardadas",
      });
      await loadData();
    } catch (err) {
      useToastStore.getState().addToast({
        type: "error",
        message: err.response?.data?.error || "Error al guardar",
      });
    } finally {
      setSaving(false);
    }
  };

  const lockText = useMemo(() => {
    if (!lockInfo.lockAt) return "Se bloquean cuando arranca el Mundial.";
    const formatted = new Date(lockInfo.lockAt).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return lockInfo.locked ? `Bloqueadas desde ${formatted}.` : `Editables hasta ${formatted}.`;
  }, [lockInfo.lockAt, lockInfo.locked]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Final del Mundial</h2>
              <p className="text-xs sm:text-sm text-white/50">
                Campeon, subcampeon, goleador y guante de oro.
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium border ${
              lockInfo.locked
                ? "bg-red-500/10 border-red-500/20 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
            }`}
          >
            {lockInfo.locked ? <Lock size={14} /> : <ShieldCheck size={14} />}
            {lockText}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="Campeon"
            value={form.championTeamId}
            onChange={(value) => handleTeamChange("championTeamId", value)}
            options={teams}
            disabled={lockInfo.locked}
            placeholder="Seleccionar equipo"
          />
          <SelectField
            label="Subcampeon"
            value={form.runnerUpTeamId}
            onChange={(value) => handleTeamChange("runnerUpTeamId", value)}
            options={teams}
            disabled={lockInfo.locked}
            placeholder="Seleccionar equipo"
          />
          <SelectField
            label="Seleccion del goleador"
            value={form.topScorerTeamId}
            onChange={(value) => handleTeamChange("topScorerTeamId", value)}
            options={teams}
            disabled={lockInfo.locked}
            placeholder="Seleccionar seleccion"
          />
          <SelectField
            label="Goleador"
            value={form.topScorerId}
            onChange={(value) => setForm((prev) => ({ ...prev, topScorerId: value }))}
            options={topScorers}
            disabled={lockInfo.locked || !form.topScorerTeamId}
            placeholder="Seleccionar jugador"
          />
          <SelectField
            label="Seleccion del guante de oro"
            value={form.goldenGloveTeamId}
            onChange={(value) => handleTeamChange("goldenGloveTeamId", value)}
            options={teams}
            disabled={lockInfo.locked}
            placeholder="Seleccionar seleccion"
          />
          <SelectField
            label="Guante de oro"
            value={form.goldenGloveId}
            onChange={(value) => setForm((prev) => ({ ...prev, goldenGloveId: value }))}
            options={goalkeepers}
            disabled={lockInfo.locked || !form.goldenGloveTeamId}
            placeholder="Seleccionar arquero"
          />
        </div>

        {form.championTeamId && form.runnerUpTeamId && form.championTeamId === form.runnerUpTeamId && (
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            <AlertCircle size={14} />
            Campeon y subcampeon no pueden ser el mismo equipo.
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving || lockInfo.locked}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Save size={15} />
        {saving ? "Guardando..." : "Guardar predicciones finales"}
      </button>
    </form>
  );
}

function SelectField({ label, value, onChange, options, disabled, placeholder }) {
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
