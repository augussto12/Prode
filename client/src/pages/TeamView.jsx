import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Calendar, MapPin } from 'lucide-react';
import api from '../services/api';
import PlayerAvatar from '../components/shared/PlayerAvatar';

export default function TeamView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [coach, setCoach] = useState(null);
  const [squad, setSquad] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('squad'); // 'squad' | 'fixtures'

  useEffect(() => {
    loadTeamData();
  }, [id]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const [infoRes, squadRes, fixturesRes, coachRes] = await Promise.all([
        api.get(`/explorer/teams/${id}`),
        api.get(`/explorer/teams/${id}/squad`).catch(() => ({ data: [] })),
        api.get(`/explorer/teams/${id}/fixtures`).catch(() => ({ data: [] })),
        api.get(`/explorer/teams/${id}/coach`).catch(() => ({ data: [] }))
      ]);
      setTeam(infoRes.data?.team);
      setSquad(squadRes.data || []);
      setCoach(coachRes.data?.[0] || null); // Usually returns array, we take first

      // Sort fixtures by date descending (newest first)
      const sortedFixtures = [...(fixturesRes.data || [])].sort((a, b) => 
        new Date(b.fixture.date) - new Date(a.fixture.date)
      );
      setFixtures(sortedFixtures);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return <div className="text-center py-10 text-white/50">Equipo no encontrado</div>;
  }

  const goalkeepers = squad.filter(p => p.position === 'Goalkeeper');
  const defenders = squad.filter(p => p.position === 'Defender');
  const midfielders = squad.filter(p => p.position === 'Midfielder');
  const attackers = squad.filter(p => p.position === 'Attacker');

  const renderPlayer = (p, idx) => (
    <div key={idx} onClick={() => navigate(`/jugador/${p.id}`)} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
      <PlayerAvatar id={p.id} photo={p.photo} name={p.name} size="md" />
      <div>
        <div className="font-bold text-sm text-white">{p.name}</div>
        <div className="text-xs text-white/50">{p.age ? `${p.age} años` : '-'}</div>
      </div>
      <div className="ml-auto flex items-center justify-center w-6 h-6 rounded-md bg-black/30 text-xs font-bold text-white border border-white/10">
        {p.number || '-'}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-all bg-transparent border-none cursor-pointer">
        <ArrowLeft size={16} /> Volver
      </button>

      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white/5 p-4 flex items-center justify-center border border-white/10 shadow-xl shrink-0">
          <img src={team.logo} alt={team.name} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 text-center md:text-left space-y-2">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">{team.name}</h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-white/60">
            <span className="flex items-center gap-1.5"><MapPin size={14} /> {team.country}</span>
            {team.founded && <span className="flex items-center gap-1.5"><Calendar size={14} /> Fundado en {team.founded}</span>}
          </div>
          {coach && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              <PlayerAvatar id={coach.id} photo={coach.photo} name={coach.name} size="sm" />
              <div className="flex flex-col">
                 <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold leading-none">Director Técnico</span>
                 <span className="text-sm font-semibold text-white leading-tight">{coach.name}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* TABS */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
        <button
          onClick={() => setActiveTab('squad')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeTab === 'squad' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-lg' : 'bg-transparent text-white/50 border-transparent hover:text-white hover:bg-white/5'}`}
        >
          Plantilla (Squad)
        </button>
        <button
          onClick={() => setActiveTab('fixtures')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeTab === 'fixtures' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-lg' : 'bg-transparent text-white/50 border-transparent hover:text-white hover:bg-white/5'}`}
        >
          Partidos Recientes
        </button>
      </div>

      {/* SQUAD AREA */}
      {activeTab === 'squad' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {squad.length === 0 ? (
            <div className="text-center py-10 text-white/40 glass-card rounded-2xl">No hay información del plantel</div>
          ) : (
            <>
              {goalkeepers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Arqueros</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {goalkeepers.map(renderPlayer)}
                  </div>
                </div>
              )}
              {defenders.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Defensores</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {defenders.map(renderPlayer)}
                  </div>
                </div>
              )}
              {midfielders.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Mediocampistas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {midfielders.map(renderPlayer)}
                  </div>
                </div>
              )}
              {attackers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Delanteros</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {attackers.map(renderPlayer)}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* FIXTURES AREA */}
      {activeTab === 'fixtures' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {fixtures.length === 0 ? (
           <div className="text-center py-10 text-white/40 glass-card rounded-2xl">No hay historial de partidos</div>
          ) : (
           fixtures.map((f) => {
             const isHome = f.teams.home.id === team.id;
             const opponent = isHome ? f.teams.away : f.teams.home;
             const goalsFor = isHome ? f.goals.home : f.goals.away;
             const goalsAgainst = isHome ? f.goals.away : f.goals.home;
             
             let resultColor = 'bg-white/5 border-white/10';
             let resultLetter = '-';
             if (f.score.fulltime.home !== null) {
               if (goalsFor > goalsAgainst) { resultColor = 'bg-green-500/20 border-green-500/50 text-green-400'; resultLetter = 'V'; }
               else if (goalsFor < goalsAgainst) { resultColor = 'bg-red-500/20 border-red-500/50 text-red-400'; resultLetter = 'D'; }
               else { resultColor = 'bg-amber-500/20 border-amber-500/50 text-amber-400'; resultLetter = 'E'; }
             }

             return (
               <div key={f.fixture.id} onClick={() => navigate(`/partido/${f.fixture.id}`)} className="glass-card rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm border shrink-0 ${resultColor}`}>
                    {resultLetter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{new Date(f.fixture.date).toLocaleDateString()}</span>
                      <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 rounded uppercase tracking-wider">{f.league.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">{isHome ? 'vs' : '@'}</span>
                      <img src={opponent.logo} alt="" className="w-5 h-5 object-contain" />
                      <span className="font-bold text-sm text-white truncate">{opponent.name}</span>
                    </div>
                  </div>
                  <div className="text-xl font-black font-mono">
                    {f.score.fulltime.home !== null ? `${f.goals.home} - ${f.goals.away}` : 'vs'}
                  </div>
               </div>
             );
           })
          )}
        </motion.div>
      )}
    </div>
  );
}
