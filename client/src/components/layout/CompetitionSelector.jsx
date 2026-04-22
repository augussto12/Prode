import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import useCompetitionStore from "../../store/competitionStore";

export default function CompetitionSelector() {
  const competitions = useCompetitionStore((state) => state.competitions);
  const activeCompetition = useCompetitionStore(
    (state) => state.activeCompetition,
  );
  const fetchCompetitions = useCompetitionStore(
    (state) => state.fetchCompetitions,
  );
  const setActive = useCompetitionStore((state) => state.setActive);
  const loading = useCompetitionStore((state) => state.loading);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  if (loading || competitions.length === 0) return null;

  // Si solo hay 1 competencia, mostrar solo el nombre (sin dropdown)
  if (competitions.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
        {activeCompetition?.logo && (
          <img             src={activeCompetition.logo}
            alt=""
            className="w-5 h-5 object-contain"
            loading="lazy"
            decoding="async"
            width={20} height={20}
  onError={(e) => {
              e.target.src = "/placeholder-team.svg";
            }}
          />
        )}
        <span className="text-white/80 text-sm font-medium">
          {activeCompetition?.name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={activeCompetition?.id || ""}
        onChange={(e) => {
          const comp = competitions.find(
            (c) => c.id === Number(e.target.value),
          );
          if (comp) setActive(comp);
        }}
        className="appearance-none bg-white/5 border border-white/10 text-white text-sm pl-3 pr-8 py-1.5 rounded-lg cursor-pointer focus:outline-none focus:border-indigo-500 transition-all"
        style={{ minWidth: "140px" }}
      >
        {competitions.map((comp) => (
          <option
            key={comp.id}
            value={comp.id}
            style={{ background: "#1e1b4b", color: "#fff" }}
          >
            {comp.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none"
      />
    </div>
  );
}
