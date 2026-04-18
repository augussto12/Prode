import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowLeft, User, Calendar, MapPin } from 'lucide-react';
import api from '../services/api';
import PlayerAvatar from '../components/shared/PlayerAvatar';

export default function TeamView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [venue, setVenue] = useState(null);
  const [coach, setCoach] = useState(null);
  const [squad, setSquad] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('squad'); // 'squad' | 'fixtures' | 'statistics' | 'transfers'

  // Transfers Pagination & Filters
  const [transferPage, setTransferPage] = useState(1);
  const [transferYear, setTransferYear] = useState(''); // '' means All Time

  useEffect(() => {
    loadTeamData();
  }, [id]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const [infoRes, squadRes, fixturesRes, coachRes, transfersRes] = await Promise.all([
        api.get(`/explorer/teams/${id}`),
        api.get(`/explorer/teams/${id}/squad`).catch(() => ({ data: [] })),
        api.get(`/explorer/teams/${id}/fixtures`).catch(() => ({ data: [] })),
        api.get(`/explorer/teams/${id}/coach`).catch(() => ({ data: [] })),
        api.get(`/explorer/teams/${id}/transfers`).catch(() => ({ data: [] }))
      ]);
      setTeam(infoRes.data?.team);
      setVenue(infoRes.data?.venue);
      setSquad(squadRes.data || []);
      setTransfers(transfersRes.data || []);
      // Resolving the active coach properly
      let activeCoach = null;
      if (coachRes.data && coachRes.data.length > 0) {
        // Obtenemos todos los entrenadores que tienen una carrera activa (end === null) en el equipo actual
        const candidateCoaches = coachRes.data.filter(c => {
          return c.career.some(career =>
            career.team.id === Number(id) && career.end === null
          );
        });

        if (candidateCoaches.length > 0) {
          // Si hay varios activos (raro pero posible en interinos encimados), priorizamos el de start más reciente
          activeCoach = candidateCoaches.sort((a, b) => {
            const getLatestStart = (coach) => {
              const careers = coach.career.filter(cr => cr.team.id === Number(id) && cr.end === null);
              if (!careers.length) return 0;
              return Math.max(...careers.map(cr => new Date(cr.start).getTime()));
            };
            return getLatestStart(b) - getLatestStart(a);
          })[0];
        } else {
          // Si no hay activos, tomamos el más reciente históricamente
          activeCoach = coachRes.data[0];
        }
      }

      setCoach(activeCoach);

      // Sort fixtures by date descending (newest first)
      const sortedFixtures = [...(fixturesRes.data || [])].sort((a, b) =>
        new Date(b.fixture.date) - new Date(a.fixture.date)
      );
      setFixtures(sortedFixtures);

      // Fetch statistics iteratively now that we can guess their primary active league
      if (sortedFixtures.length > 0) {
        // Encontrar la liga más frecuente en sus partidos recientes (suele ser la liga local)
        const leagueCounts = {};
        sortedFixtures.forEach(f => {
          leagueCounts[f.league.id] = (leagueCounts[f.league.id] || 0) + 1;
        });
        const primaryLeagueId = Object.keys(leagueCounts).reduce((a, b) => leagueCounts[a] > leagueCounts[b] ? a : b);

        const statsRes = await api.get(`/explorer/teams/${id}/statistics?league=${primaryLeagueId}`).catch(() => ({ data: null }));
        setStatistics(statsRes.data);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Computed values for Transfers Tab
  const allTransfers = useMemo(() => {
    if (!transfers.length) return [];
    const flattened = [];
    transfers.forEach(tGroup => {
      tGroup.transfers.forEach(tr => {
        flattened.push({
          player: tGroup.player,
          ...tr
        });
      });
    });
    return flattened.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transfers]);

  const transferYears = useMemo(() => {
    const years = new Set(allTransfers.map(tr => tr.date.substring(0, 4)));
    return Array.from(years).sort((a, b) => b - a);
  }, [allTransfers]);

  const filteredTransfers = useMemo(() => {
    return allTransfers.filter(tr => transferYear === '' || tr.date.startsWith(transferYear));
  }, [allTransfers, transferYear]);

  const TRANSFERS_PER_PAGE = 10;
  const totalTransferPages = Math.ceil(filteredTransfers.length / TRANSFERS_PER_PAGE);
  const currentTransfers = filteredTransfers.slice(
    (transferPage - 1) * TRANSFERS_PER_PAGE,
    transferPage * TRANSFERS_PER_PAGE
  );

  // Reset page when year changes
  useEffect(() => { setTransferPage(1); }, [transferYear]);

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
    <div className="space-y-6 max-w-8xl mx-auto pb-10">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-all bg-transparent border-none cursor-pointer">
        <ArrowLeft size={16} /> Volver
      </button>

      {/* HEADER */}
      <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white/5 p-4 flex items-center justify-center border border-white/10 shadow-xl shrink-0">
          <img src={team.logo} alt={team.name} width={80} height={80} className="w-full h-full object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
        </div>
        <div className="flex-1 text-center md:text-left space-y-2">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">{team.name}</h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-white/60 mt-1">
            <span className="flex items-center gap-1.5"><MapPin size={14} /> {team.country}</span>
            {team.founded && <span className="flex items-center gap-1.5"><Calendar size={14} /> Fundado en {team.founded}</span>}
          </div>
          {venue && (
            <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-white/40 mt-1">
              <span className="truncate max-w-[200px] md:max-w-md">Estadio {venue.name} — {venue.city} ({venue.capacity ? venue.capacity.toLocaleString() : '?'} cap)</span>
            </div>
          )}
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
      </m.div>

      {/* TABS */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full sm:w-fit overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('squad')}
          className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'squad' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-md' : 'bg-transparent text-white/50 border-transparent hover:text-white hover:bg-white/5'}`}
        >
          Plantel
        </button>
        <button
          onClick={() => setActiveTab('fixtures')}
          className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'fixtures' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-md' : 'bg-transparent text-white/50 border-transparent hover:text-white hover:bg-white/5'}`}
        >
          Partidos
        </button>
        {statistics && (
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'statistics' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-md' : 'bg-transparent text-white/50 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            Estadísticas
          </button>
        )}
        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'transfers' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-md' : 'bg-transparent text-white/50 border-transparent hover:text-white hover:bg-white/5'}`}
        >
          Fichajes
        </button>
      </div>

      {/* SQUAD AREA */}
      {activeTab === 'squad' && (
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
        </m.div>
      )}

      {/* FIXTURES AREA */}
      {activeTab === 'fixtures' && (
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {fixtures.length === 0 ? (
            <div className="text-center py-10 text-white/40 glass-card rounded-2xl">No hay historial de partidos</div>
          ) : (() => {
            const now = new Date();
            const INITIAL_SHOW = 6; // Mostrar 6 por defecto (3 filas en grid de 2)
            // Partidos jugados (más reciente primero) y próximos (más cercano primero)
            const played = fixtures.filter(f => new Date(f.fixture.date) < now && f.fixture.status?.short !== 'NS').sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
            const upcoming = fixtures.filter(f => new Date(f.fixture.date) >= now || f.fixture.status?.short === 'NS').sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

            const renderFixture = (f) => {
              const isHome = f.teams.home.id === team.id;
              const opponent = isHome ? f.teams.away : f.teams.home;
              const goalsFor = isHome ? f.goals.home : f.goals.away;
              const goalsAgainst = isHome ? f.goals.away : f.goals.home;
              const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT'].includes(f.fixture.status?.short);

              let resultColor = 'bg-white/5 border-white/10';
              let resultLetter = '-';
              if (isLive) {
                resultColor = 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse';
                resultLetter = f.fixture.status?.elapsed ? `${f.fixture.status.elapsed}'` : '⏱';
              } else if (f.score.fulltime.home !== null) {
                if (goalsFor > goalsAgainst) { resultColor = 'bg-green-500/20 border-green-500/50 text-green-400'; resultLetter = 'V'; }
                else if (goalsFor < goalsAgainst) { resultColor = 'bg-red-500/20 border-red-500/50 text-red-400'; resultLetter = 'D'; }
                else { resultColor = 'bg-amber-500/20 border-amber-500/50 text-amber-400'; resultLetter = 'E'; }
              }

              return (
                <div key={f.fixture.id} onClick={() => navigate(`/partido/${f.fixture.id}`)} className={`glass-card rounded-xl p-3 md:p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all ${isLive ? 'ring-1 ring-red-500/30' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border shrink-0 ${resultColor}`}>
                    {resultLetter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{new Date(f.fixture.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                      <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 rounded uppercase tracking-wider truncate max-w-[120px]">{f.league.name}</span>
                      {isLive && <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-1.5 rounded font-bold"><span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />LIVE</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">{isHome ? 'vs' : '@'}</span>
                      <img src={opponent.logo} alt={opponent.name} width={20} height={20} className="w-5 h-5 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
                      <span className="font-bold text-sm text-white truncate">{opponent.name}</span>
                    </div>
                  </div>
                  <div className="text-lg font-black font-mono shrink-0">
                    {f.score.fulltime.home !== null || isLive ? `${f.goals.home}-${f.goals.away}` : (
                      <span className="text-white/40 text-sm font-medium">{new Date(f.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <FixtureSections upcoming={upcoming} played={played} renderFixture={renderFixture} initialShow={INITIAL_SHOW} />
            );
          })()}
        </m.div>
      )}
      {/* STATISTICS AREA */}
      {activeTab === 'statistics' && statistics && (
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <div className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-3 flex items-center justify-between">
              <span>Rendimiento Global ({statistics.league?.name})</span>
              {statistics.form && (
                <div className="flex gap-1">
                  {statistics.form.split('').slice(-6).map((char, i) => (
                    <span key={i} className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold text-white ${char === 'W' ? 'bg-emerald-500/60' : char === 'L' ? 'bg-red-500/60' : 'bg-amber-500/60'
                      }`}>{char}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <div className="text-2xl font-black text-white">{statistics.fixtures?.played?.total || 0}</div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">Jugados</div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                <div className="text-2xl font-black text-emerald-400">{statistics.fixtures?.wins?.total || 0}</div>
                <div className="text-[10px] text-emerald-400/50 uppercase tracking-wider">Victorias</div>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 text-center border border-red-500/20">
                <div className="text-2xl font-black text-red-400">{statistics.fixtures?.loses?.total || 0}</div>
                <div className="text-[10px] text-red-400/50 uppercase tracking-wider">Derrotas</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-bold">Goles (A favor / En contra)</div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-black text-emerald-300">+{statistics.goals?.for?.total?.total || 0}</div>
                  <div className="text-xl font-black text-red-300">-{statistics.goals?.against?.total?.total || 0}</div>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-bold">Vallas Invictas</div>
                <div className="text-xl font-black text-blue-300">{statistics.clean_sheet?.total || 0} arcos en cero</div>
              </div>
            </div>

            {statistics.biggest && (
              <div className="mt-3 bg-white/5 rounded-xl p-4 border border-white/5 text-sm flex justify-between">
                <div>
                  <div className="text-white/40 text-[10px] uppercase">Racha Victorias</div>
                  <div className="font-bold text-white">{statistics.biggest.streak?.wins || 0} Partidos</div>
                </div>
                <div className="text-right">
                  <div className="text-white/40 text-[10px] uppercase">Mayor Goleada</div>
                  <div className="font-bold text-white text-emerald-400">
                    {statistics.biggest.wins?.home || '-'} (L) / {statistics.biggest.wins?.away || '-'} (V)
                  </div>
                </div>
              </div>
            )}
          </div>
        </m.div>
      )}

      {/* TRANSFERS AREA */}
      {activeTab === 'transfers' && (
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

          {/* Filters */}
          {allTransfers.length > 0 && (
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="text-xs font-bold text-white/50 uppercase tracking-wider">Historial de Operaciones</div>
              <select
                value={transferYear}
                onChange={(e) => setTransferYear(e.target.value)}
                className="bg-black/40 border border-white/10 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="">De todos los tiempos</option>
                {transferYears.map(y => <option key={y} value={y}>Año {y}</option>)}
              </select>
            </div>
          )}

          {currentTransfers.length === 0 ? (
            <div className="text-center py-10 text-white/40 glass-card rounded-2xl">No hay historial de fichajes recientes publicado para este periodo.</div>
          ) : (
            <div className="space-y-3">
              {currentTransfers.map((tr, idx) => {
                const isIncoming = tr.teams.in.id === Number(id);
                const otherTeam = isIncoming ? tr.teams.out : tr.teams.in;

                return (
                  <div key={idx} className="glass-card rounded-xl border border-white/10 overflow-hidden flex flex-col md:flex-row md:items-center">
                    {/* Left Side: Player */}
                    <div className="flex items-center gap-3 p-4 border-b md:border-b-0 md:border-r border-white/5 md:w-1/3 bg-white/[0.02]">
                      <PlayerAvatar id={tr.player.id} photo={null} name={tr.player.name} size="md" />
                      <h3 className="font-bold text-white text-sm">{tr.player.name}</h3>
                    </div>

                    {/* Right Side: Transfer Info */}
                    <div className="flex-1 p-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
                      <div className="flex flex-col gap-1 items-center sm:items-start w-full sm:w-auto">
                        <span className="text-white/40 text-[10px] uppercase font-bold">{tr.date}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded uppercase font-black text-[10px] min-w-[50px] text-center ${isIncoming ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {isIncoming ? 'ALTA' : 'BAJA'}
                          </span>
                          <span className="text-white/70 font-semibold text-[10px] bg-black/20 px-2 py-0.5 rounded">
                            {tr.type === 'Free' ? 'Libre' : tr.type === 'Loan' ? 'Préstamo' : tr.type === 'N/A' ? 'Desconocido' : tr.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end bg-black/20 sm:bg-transparent rounded-lg p-2 sm:p-0">
                        <span className="text-white/50 text-xs font-medium">{isIncoming ? 'Desde:' : 'Hacia:'}</span>
                        <img src={otherTeam.logo} alt="" width={32} height={32} className="w-8 h-8 object-contain" loading="lazy" decoding="async" onError={(e) => { e.target.src = '/placeholder-team.svg'; }} />
                        <span className="text-white font-bold text-sm truncate max-w-[120px]">{otherTeam.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalTransferPages > 1 && (
            <div className="flex items-center justify-between pt-4 pb-2 border-t border-white/5">
              <button
                onClick={() => setTransferPage(prev => Math.max(1, prev - 1))}
                disabled={transferPage === 1}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-all border border-white/10"
              >
                Anterior
              </button>
              <span className="text-xs text-white/50 font-bold">
                Página {transferPage} de {totalTransferPages}
              </span>
              <button
                onClick={() => setTransferPage(prev => Math.min(totalTransferPages, prev + 1))}
                disabled={transferPage === totalTransferPages}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-all border border-white/10"
              >
                Siguiente
              </button>
            </div>
          )}
        </m.div>
      )}

    </div>
  );
}

// Componente separado con su propio state para "ver más" — evita re-mount del padre
// Layout: 2 columnas lado a lado en desktop (próximos | últimos resultados)
function FixtureSections({ upcoming, played, renderFixture, initialShow }) {
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPlayed, setShowAllPlayed] = useState(false);

  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, initialShow);
  const visiblePlayed = showAllPlayed ? played : played.slice(0, initialShow);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Columna izquierda: Próximos */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-indigo-500/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Próximos Partidos</h3>
            <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{upcoming.length}</span>
          </div>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm bg-white/[0.02] rounded-xl border border-white/5">Sin partidos programados</div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleUpcoming.map(renderFixture)}
            </div>
            {upcoming.length > initialShow && !showAllUpcoming && (
              <button
                onClick={() => setShowAllUpcoming(true)}
                className="w-full mt-3 py-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl transition-all border border-indigo-500/20 cursor-pointer"
              >
                Ver todos ({upcoming.length - initialShow} más)
              </button>
            )}
          </>
        )}
      </div>

      {/* Columna derecha: Últimos Resultados */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/30" />
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Últimos Resultados</h3>
            <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{played.length}</span>
          </div>
        </div>
        {played.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm bg-white/[0.02] rounded-xl border border-white/5">Sin resultados recientes</div>
        ) : (
          <>
            <div className="space-y-2">
              {visiblePlayed.map(renderFixture)}
            </div>
            {played.length > initialShow && !showAllPlayed && (
              <button
                onClick={() => setShowAllPlayed(true)}
                className="w-full mt-3 py-2 text-xs font-medium text-white/40 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 cursor-pointer"
              >
                Ver todos ({played.length - initialShow} más)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
