import { useState, useEffect, useMemo } from "react";
import { LayoutDashboard, Save, Check } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import api from "../services/api";
import useCompetitionStore from "../store/competitionStore";
import Pitch from "../components/dreamteam/Pitch";
import useToastStore from "../store/toastStore";

export default function DreamTeam() {
  const [formation, setFormation] = useState("1-2-1");
  const [players, setPlayers] = useState([]); // from API catalog
  const [team, setTeam] = useState({
    gkId: null,
    def1Id: null,
    def2Id: null,
    mid1Id: null,
    mid2Id: null,
    fwd1Id: null,
    fwd2Id: null,
  });

  const [filter, setFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const activeCompetition = useCompetitionStore(
    (state) => state.activeCompetition,
  );

  useEffect(() => {
    if (activeCompetition?.id) loadData();
  }, [activeCompetition?.id]);

  const loadData = async () => {
    try {
      const compParam = activeCompetition?.id
        ? `?competitionId=${activeCompetition.id}`
        : "";
      const { data: pData } = await api.get(`/dreamteam/players${compParam}`);
      setPlayers(pData);

      const { data: teamData } = await api.get(`/dreamteam${compParam}`);
      if (teamData) {
        setFormation(teamData.formation || "1-2-1");
        setTeam({
          gkId: teamData.gkId,
          def1Id: teamData.def1Id,
          def2Id: teamData.def2Id,
          mid1Id: teamData.mid1Id,
          mid2Id: teamData.mid2Id,
          fwd1Id: teamData.fwd1Id,
          fwd2Id: teamData.fwd2Id,
        });
      }
    } catch (err) {
      console.error("Failed to load dream team data", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/dreamteam", {
        formation,
        players: team,
        competitionId: activeCompetition?.id,
      });
      useToastStore
        .getState()
        .addToast({
          type: "success",
          message: "¡Dream Team guardado correctamente!",
        });
    } catch (err) {
      useToastStore
        .getState()
        .addToast({ type: "error", message: "Error guardando equipo" });
    } finally {
      setSaving(false);
    }
  };

  const handleFormationChange = (newFormation) => {
    if (newFormation === formation) return;

    const newLayout = {
      "1-2-1": {
        GK: ["gkId"],
        DEF: ["def1Id", "def2Id"],
        MID: ["mid2Id"],
        FWD: ["fwd1Id"],
      },
      "1-1-2": {
        GK: ["gkId"],
        DEF: ["def2Id"],
        MID: ["mid1Id"],
        FWD: ["fwd1Id", "fwd2Id"],
      },
      "2-1-1": {
        GK: ["gkId"],
        DEF: ["def1Id", "def2Id"],
        MID: ["mid1Id"],
        FWD: ["fwd1Id"],
      },
    }[newFormation];

    const currentByPos = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const slotKey in team) {
      const playerId = team[slotKey];
      if (playerId) {
        const p = players.find((x) => x.id === playerId);
        if (p) currentByPos[p.position].push(playerId);
      }
    }

    const newTeam = {
      gkId: null,
      def1Id: null,
      def2Id: null,
      mid1Id: null,
      mid2Id: null,
      fwd1Id: null,
      fwd2Id: null,
    };

    for (const pos of ["GK", "DEF", "MID", "FWD"]) {
      const availableSlots = newLayout[pos] || [];
      const playersInPos = currentByPos[pos];
      for (
        let i = 0;
        i < Math.min(availableSlots.length, playersInPos.length);
        i++
      ) {
        newTeam[availableSlots[i]] = playersInPos[i];
      }
    }

    setFormation(newFormation);
    setTeam(newTeam);
  };

  const handleAddPlayer = (player) => {
    // Determine which slot is available based on player.position and current formation
    // Allowed slots per formation:
    const layout = {
      "1-2-1": {
        GK: ["gkId"],
        DEF: ["def1Id", "def2Id"],
        MID: ["mid2Id"],
        FWD: ["fwd1Id"],
      },
      "1-1-2": {
        GK: ["gkId"],
        DEF: ["def2Id"],
        MID: ["mid1Id"],
        FWD: ["fwd1Id", "fwd2Id"],
      },
      "2-1-1": {
        GK: ["gkId"],
        DEF: ["def1Id", "def2Id"],
        MID: ["mid1Id"],
        FWD: ["fwd1Id"],
      },
    }[formation];

    const possibleSlots = layout[player.position];
    if (!possibleSlots) {
      useToastStore
        .getState()
        .addToast({
          type: "warning",
          message: `La formación actual no permite añadir un '${player.position}'.`,
        });
      return;
    }

    // Is the exact player already in ANY slot?
    for (const slotKey in team) {
      if (team[slotKey] === player.id) {
        // remove him so we can re-add or just warn
        return; // already inserted
      }
    }

    // Find first empty slot
    let foundSlot = null;
    for (const slot of possibleSlots) {
      if (!team[slot]) {
        foundSlot = slot;
        break;
      }
    }

    if (foundSlot) {
      setTeam((prev) => ({ ...prev, [foundSlot]: player.id }));
    } else {
      useToastStore
        .getState()
        .addToast({
          type: "warning",
          message: `No tenés espacio para más '${player.position}'. Eliminá alguno haciendo click en la cancha.`,
        });
    }
  };

  const handleRemoveSlot = (slotKey) => {
    setTeam((prev) => ({ ...prev, [`${slotKey}Id`]: null }));
  };

  // Map team IDs to Full Player objects for Pitch UI
  const populatedTeam = useMemo(() => {
    const obj = {};
    for (const slot in team) {
      if (team[slot]) {
        obj[slot.replace("Id", "")] = players.find((p) => p.id === team[slot]);
      } else {
        obj[slot.replace("Id", "")] = null;
      }
    }
    return obj;
  }, [team, players]);

  // Current selected count
  const count = Object.values(team).filter((v) => v !== null).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-gradient-to-r from-emerald-600 to-indigo-600" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Mi Dream Team
            </h1>
            <p className="text-white/60 text-sm">
              Armá tu 5 ideal. Recibirás puntos cuando anoten goles o asistan en
              la vida real.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Formation selector */}
            <div className="flex bg-black/20 rounded-xl p-1 border border-white/5">
              {["1-2-1", "1-1-2", "2-1-1"].map((form) => (
                <button
                  key={form}
                  onClick={() => handleFormationChange(form)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border-none cursor-pointer ${
                    formation === form
                      ? "bg-white/10 text-emerald-400"
                      : "text-white/50 bg-transparent hover:text-white"
                  }`}
                >
                  {form}
                </button>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || count < 5}
              className="px-4 sm:px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors border-none text-xs sm:text-sm"
            >
              <Save size={16} /> {saving ? "..." : `Guardar (${count}/5)`}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pitch Area (2 Cols) */}
        <div className="lg:col-span-2">
          <Pitch
            formation={formation}
            players={populatedTeam}
            onRemove={handleRemoveSlot}
          />
        </div>

        {/* Players Bazar (1 Col) */}
        <div className="glass-card rounded-2xl flex flex-col h-[400px] lg:h-[650px] overflow-hidden border border-white/10 shadow-2xl">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h3 className="font-bold text-white mb-3">Catálogo de Jugadores</h3>

            {/* Filters */}
            <div className="flex gap-2">
              {["ALL", "GK", "DEF", "MID", "FWD"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    filter === f
                      ? "bg-indigo-500 text-white border-transparent"
                      : "bg-transparent text-white/50 border border-white/10 hover:bg-white/5"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
            <div className="space-y-1">
              {/* Player list - no AnimatePresence for perf */}
              {players
                .filter((p) => filter === "ALL" || p.position === filter)
                .map((p) => {
                  const isSelected = Object.values(team).includes(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                        isSelected
                          ? "bg-white/[0.03] opacity-60 border-emerald-500/30"
                          : "hover:bg-white/[0.05] cursor-pointer"
                      } border border-transparent`}
                      onClick={() => {
                        if (!isSelected) handleAddPlayer(p);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <img                           src={
                            p.image ||
                            "https://cdn-icons-png.flaticon.com/512/3112/3112946.png"
                          }
                          loading="lazy"
                          className="w-10 h-10 rounded-full bg-black/50 border border-white/20 object-cover"
                          decoding="async" width={40} height={40}
  onError={(e) => {
                            e.target.src = "/placeholder-team.svg";
                          }}
                        />
                        <div>
                          <div className="text-sm font-bold text-white/90">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-white/60 uppercase tracking-widest">
                            {p.position} • {p.country}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <Check size={16} className="text-emerald-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
