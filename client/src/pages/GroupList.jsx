import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { Plus, Users, LogIn, Copy, Check, Globe, Loader2, Trophy } from "lucide-react";
import api from "../services/api";
import useToastStore from "../store/toastStore";
import useCompetitionStore from "../store/competitionStore";
import { getGroupCardVariant } from "../utils/groupCardVariants";

export default function GroupList() {
  const [myGroups, setMyGroups] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    isPublic: false,
    joinPolicy: "OPEN_WITH_CODE",
  });
  const navigate = useNavigate();
  const activeCompetition = useCompetitionStore(
    (state) => state.activeCompetition,
  );
  const competitions = useCompetitionStore((state) => state.competitions);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const [myRes, pubRes] = await Promise.all([
        api.get("/groups"),
        api.get("/groups/public"),
      ]);
      setMyGroups(myRes.data);
      setPublicGroups(
        pubRes.data.filter((pg) => !myRes.data.some((mg) => mg.id === pg.id)),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    // Siempre usar el torneo activo (Mundial 2026) o default a 1
    const compId = activeCompetition?.id || 1;
    try {
      setIsCreating(true);
      const { data } = await api.post("/groups", {
        ...createForm,
        competitionId: Number(compId),
      });
      navigate(`/groups/${data.id}`);
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Error al crear grupo",
        });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/groups/join", { inviteCode: joinCode });
      navigate(`/groups/${data.id}`);
    } catch (err) {
      useToastStore
        .getState()
        .addToast({
          type: "error",
          message: err.response?.data?.error || "Código inválido",
        });
    }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Grupos</h1>
          <p className="text-white/50 text-sm mt-1">
            Creá o unite a grupos para competir con amigos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowCreate(!showCreate);
              setShowJoin(false);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer border-none text-white transition-all hover:opacity-90"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
            }}
          >
            <Plus size={16} /> Crear Grupo
          </button>
          <button
            onClick={() => {
              setShowJoin(!showJoin);
              setShowCreate(false);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer border border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent transition-all"
          >
            <LogIn size={16} /> Unirme
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Nuevo Grupo</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/60 text-sm mb-1">
                  Nombre del grupo *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ej: Los Pibes del Barrio"
                />
              </div>
              <div>
                <label className="block text-white/60 text-sm mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={createForm.isPublic}
                onChange={(e) =>
                  setCreateForm({ ...createForm, isPublic: e.target.checked })
                }
                className="rounded cursor-pointer"
              />
              <label
                htmlFor="isPublic"
                className="text-sm text-white/60 cursor-pointer"
              >
                Grupo público (visible para todos)
              </label>
            </div>

            <div>
              <label className="block text-white/60 text-sm mb-1">
                Entrada al grupo
              </label>
              <select
                value={createForm.joinPolicy}
                onChange={(e) =>
                  setCreateForm({ ...createForm, joinPolicy: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="OPEN_WITH_CODE">Cualquiera con codigo</option>
                <option value="WHITELIST_WITH_CODE">
                  Solo usuarios habilitados + codigo
                </option>
                <option value="INVITE_ONLY">Solo invitacion de un uso</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="px-6 py-2.5 rounded-xl text-white font-medium text-sm cursor-pointer border-none hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
              }}
            >
              {isCreating && <Loader2 size={16} className="animate-spin" />}
              {isCreating ? "Creando..." : "Crear Grupo"}
            </button>
          </form>
        </m.div>
      )}

      {/* Join Form */}
      {showJoin && (
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            Unirme con código
          </h3>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
              placeholder="Pegar código de invitación"
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-white font-medium text-sm cursor-pointer border-none hover:opacity-90"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 30%, var(--color-secondary) 100%)",
              }}
            >
              Unirme
            </button>
          </form>
        </m.div>
      )}

      {/* My Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myGroups.map((group, i) => {
          const variant = getGroupCardVariant(group, i);
          const rank = Number(group.rank);
          const hasRank = Number.isFinite(rank) && rank > 0;

          return (
          <m.div
            key={group.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/groups/${group.id}`}
              className="block rounded-2xl p-5 transition-all duration-300 no-underline group border hover:-translate-y-0.5"
              style={{
                background: variant.background,
                borderColor: variant.border,
                boxShadow: variant.shadow,
              }}
            >
              <div
                className="h-1 w-16 rounded-full mb-4"
                style={{ background: variant.accent }}
              />
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white border"
                  style={{
                    background: variant.badge,
                    borderColor: variant.border,
                  }}
                >
                  <Users size={20} />
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    copyCode(group.inviteCode, group.id);
                  }}
                  className="text-white/50 hover:text-white/60 bg-transparent border-none cursor-pointer p-1"
                  title="Copiar código"
                  aria-label="Copiar código de invitación"
                >
                  {copiedId === group.id ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              <h3 className="text-white font-semibold text-base mb-1 group-hover:text-indigo-300 transition-colors">
                {group.name}
              </h3>
              <p className="text-white/60 text-xs mb-3 line-clamp-1">
                {group.description || "Sin descripción"}
              </p>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {group.memberCount} miembros
                </span>
                <span
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black text-white shadow-sm"
                  title="Tu posicion en el grupo"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${variant.accent} 24%, transparent), rgba(255,255,255,0.04))`,
                    borderColor: variant.border,
                    boxShadow: `0 0 18px color-mix(in srgb, ${variant.accent} 18%, transparent)`,
                  }}
                >
                  <Trophy size={12} style={{ color: variant.accent }} />
                  <span>{hasRank ? `#${rank}` : "-"}</span>
                  {hasRank && (
                    <span className="font-semibold text-white/45">
                      / {group.memberCount}
                    </span>
                  )}
                </span>
              </div>
              {group.competition && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                  {group.competition.logo && (
                    <img
                      src={group.competition.logo}
                      alt=""
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      
  onError={(e) => {
                        e.target.src = "/placeholder-team.svg";
                      }}
                    />
                  )}
                  <span className="text-[10px] text-white/60 uppercase tracking-wider">
                    {group.competition.name}
                  </span>
                </div>
              )}
            </Link>
          </m.div>
          );
        })}
      </div>

      {myGroups.length === 0 && (
        <div className="text-center py-12 text-white/60">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p>Todavía no estás en ningún grupo</p>
          <p className="text-sm mt-1">
            Creá uno o unite con un código de invitación
          </p>
        </div>
      )}

      {/* Public Groups */}
      {publicGroups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Globe size={18} className="text-white/60" /> Grupos Públicos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicGroups.map((group) => (
              <div key={group.id} className="glass-card rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-1">{group.name}</h3>
                <p className="text-white/60 text-xs mb-3">
                  {group.description || "Sin descripción"}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60 flex items-center gap-1">
                    <Users size={12} /> {group._count?.groupUsers} miembros
                  </span>
                  <button
                    onClick={async () => {
                      await api.post("/groups/join", {
                        inviteCode: group.inviteCode,
                      });
                      loadGroups();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 border border-indigo-400/30 bg-indigo-500/10 cursor-pointer hover:bg-indigo-500/20 transition-all"
                  >
                    Unirme
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
