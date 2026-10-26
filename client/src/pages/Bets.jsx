import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Bookmark, CirclePlus, Compass, Link2, LockKeyhole, MessageCircle, Search, Ticket, Trophy, Users, RefreshCw } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api, { getApiErrorMessage } from '../services/api';
import BetComposer from '../components/bets/BetComposer';
import BetPost from '../components/bets/BetPost';
import './bets.css';

export default function Bets({ home = false, groupId: fixedGroupId }) {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [mode, setMode] = useState(searchParams.get('view') === 'saved' ? 'saved' : searchParams.get('view') === 'mine' ? 'mine' : 'all');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [composer, setComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  const groupId = fixedGroupId || (selectedGroup ? Number(selectedGroup) : undefined);
  const visibleGroups = fixedGroupId ? groups.filter((group) => group.id === Number(fixedGroupId)) : groups;

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true;
    api.get('/groups').then(({ data }) => { if (active) setGroups(data); }).catch((err) => { if (active) setError(getApiErrorMessage(err)); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const current = ++requestId.current;
    setLoading(true); setError(''); setItems([]); setNextCursor(null);
    api.get('/community/posts', { params: { groupId, mode, kind, query } }).then(({ data }) => {
      if (current === requestId.current) { setItems(data.items); setNextCursor(data.nextCursor); }
    }).catch((err) => { if (current === requestId.current) setError(getApiErrorMessage(err)); }).finally(() => { if (current === requestId.current) setLoading(false); });
    return () => { if (requestId.current === current) requestId.current = current + 1; };
  }, [userId, groupId, mode, kind, query, refresh]);

  async function more() {
    const current = requestId.current;
    setLoading(true); setError('');
    try { const { data } = await api.get('/community/posts', { params: { groupId, mode, kind, query, before: nextCursor } }); if (current === requestId.current) { setItems((old) => [...old, ...data.items]); setNextCursor(data.nextCursor); } }
    catch (err) { if (current === requestId.current) setError(getApiErrorMessage(err)); }
    finally { if (current === requestId.current) setLoading(false); }
  }
  function changeMode(value) { setMode(value); if (!fixedGroupId) setSearchParams(value === 'all' ? {} : { view: value }, { replace: true }); }

  if (!user) return <div className="bets-page"><section className="bet-hero bet-landing">
    <div className="bet-hero-copy"><span className="bet-eyebrow"><span className="bet-live-dot" /> TU GRUPO. TUS PARTIDOS.</span><h1>El deporte se vive<br /><em>entre amigos.</em></h1><p>Compartí tus tickets, cruzá opiniones y seguí el Prode. Un lugar para toda la conversación de tu grupo.</p><div className="bet-actions"><Link className="bet-button" to="/register">Crear mi cuenta <ArrowUpRight size={18} /></Link><Link className="bet-button bet-button-quiet" to="/login">Ya tengo cuenta</Link></div><span className="bet-hero-note"><LockKeyhole size={14} /> Publicaciones privadas · Acceso por grupo</span></div>
    <div className="bet-hero-art" aria-hidden="true"><div className="bet-orbit" /><div className="bet-art-ticket"><Ticket size={35} /><span>UN ENLACE.<br />MUCHO PARA HABLAR.</span><div className="bet-art-line" /><div className="bet-art-line short" /><div className="bet-art-footer"><MessageCircle size={19} /><Users size={19} /><Bookmark size={19} /></div></div><span className="bet-art-tag">La charla sigue acá ↗</span></div>
  </section><div className="bet-feature-grid">{[
    [<Link2 size={22} />, 'Pegá el enlace', 'Compartí el ticket original de Stake, con detalle cuando esté disponible.'],
    [<Users size={22} />, 'Elegí tu grupo', 'Tus publicaciones y comentarios quedan entre sus integrantes.'],
    [<Trophy size={22} />, 'También está el Prode', 'Los torneos, pronósticos y el chat siguen en el mismo lugar.'],
  ].map(([icon, title, description]) => <div className="bet-panel bet-feature" key={title}>{icon}<h2>{title}</h2><p>{description}</p></div>)}</div><Link className="bet-explore-link" to="/explorar">Explorar partidos sin iniciar sesión <ArrowUpRight size={16} /></Link></div>;

  return <div className={`bets-page ${fixedGroupId ? 'bet-embedded' : ''}`}>
    {!fixedGroupId && (home ? <section className="bet-hero bet-home-hero"><div className="bet-hero-copy"><span className="bet-eyebrow"><span className="bet-live-dot" /> TU COMUNIDAD DEPORTIVA</span><h1>La próxima charla<br /><em>arranca acá.</em></h1><p>Hola, {user.displayName?.split(' ')[0] || user.username}. Compartí una apuesta, mirá qué publicaron tus amigos y sumate a la conversación.</p><div className="bet-actions"><button className="bet-button" onClick={() => setComposer(true)}><CirclePlus size={18} /> Compartir apuesta</button><Link className="bet-button bet-button-quiet" to="/groups"><Users size={17} /> Mis grupos</Link></div></div><div className="bet-home-aside"><span className="bet-eyebrow">TODO EN TU GRUPO</span><strong>Compartir.<br />Comentar.<br /><span>Disfrutar.</span></strong><span className="bet-hero-note"><LockKeyhole size={14} /> Solo entre integrantes.</span></div></section> : <div className="bet-page-heading"><div><span className="bet-eyebrow">LA COMUNIDAD</span><h1>Apuestas compartidas</h1><p>Tickets, opiniones y la charla de tus grupos.</p></div><button className="bet-button" onClick={() => setComposer(true)}><CirclePlus size={17} /> Compartir apuesta</button></div>)}
    <div className="bet-layout"><div className="bet-feed-column">
      {composer ? <BetComposer groups={visibleGroups} fixedGroupId={fixedGroupId} onClose={() => setComposer(false)} onPublished={(post) => { setComposer(false); setMode('all'); if (!fixedGroupId) { setSelectedGroup(String(post.group.id)); setSearchParams({}, { replace: true }); } setSearch(''); setQuery(''); setKind('all'); setRefresh((value) => value + 1); }} /> : <button className="bet-composer-prompt bet-panel" onClick={() => setComposer(true)}><span className="bet-avatar">{(user.displayName || user.username).slice(0, 1)}</span><span>¿Qué apuesta querés compartir?</span><span className="bet-prompt-link"><Link2 size={17} /> Pegar enlace</span></button>}
      <div className="bet-feed-toolbar"><div className="bet-feed-tabs" role="group" aria-label="Filtrar publicaciones">{[['all', 'Del grupo', <MessageCircle size={16} />], ['mine', 'Mis apuestas', <Ticket size={16} />], ['saved', 'Guardados', <Bookmark size={16} />]].map(([value, label, icon]) => <button key={value} className={mode === value ? 'is-active' : ''} aria-pressed={mode === value} onClick={() => changeMode(value)}>{icon}{value === 'all' && !fixedGroupId ? 'Mis grupos' : label}</button>)}</div><button className="bet-icon-button" aria-label="Actualizar publicaciones" onClick={() => setRefresh((value) => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
      <div className="bet-filters"><form className="bet-search" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}><Search size={16} /><input aria-label="Buscar por autor o comentario" placeholder="Buscar autor o comentario…" maxLength={100} value={search} onChange={(e) => setSearch(e.target.value)} /><button type="submit">Buscar</button></form>{!fixedGroupId && <select aria-label="Filtrar por grupo" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}><option value="">Todos mis grupos</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}<select aria-label="Filtrar por tipo de publicación" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Todos los tickets</option><option value="ready">Con detalle</option><option value="link_only">Solo enlaces</option></select></div>
      {error && <div className="bet-error" role="alert">{error}<button className="bet-button bet-button-quiet" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div>}
      {!loading && !error && !items.length && <div className="bet-empty bet-panel"><div className="bet-empty-icon">{mode === 'saved' ? <Bookmark size={28} /> : <MessageCircle size={28} />}</div><h2>{query || kind !== 'all' ? 'No encontramos publicaciones' : mode === 'saved' ? 'Tus guardados, a mano' : mode === 'mine' ? 'Tu primera apuesta compartida' : 'La conversación empieza con vos'}</h2><p>{query || kind !== 'all' ? 'Probá con otra búsqueda o cambiá los filtros.' : mode === 'saved' ? 'Guardá una publicación para volver a verla desde acá.' : 'Pegá el enlace de un ticket y compartilo con tus amigos. No necesitás subir capturas.'}</p>{!groups.length ? <Link className="bet-button" to="/groups"><Users size={16} /> Crear o unirme a un grupo</Link> : mode !== 'saved' && <button className="bet-button" onClick={() => setComposer(true)}><CirclePlus size={16} /> Compartir una apuesta</button>}</div>}
      {items.map((post) => <BetPost key={post.id} post={post} userId={user.id} onChange={(updated) => setItems((old) => old.flatMap((item) => item.id !== updated.id ? [item] : mode === 'saved' && !updated.saved ? [] : [updated]))} onDelete={(id) => setItems((old) => old.filter((item) => item.id !== id))} />)}
      {loading && <div className="bet-feed-skeleton" role="status" aria-label="Cargando publicaciones"><div /><div /><div /></div>}
      {nextCursor && !loading && <button className="bet-button bet-button-quiet bet-load-more" onClick={more}>Ver más publicaciones</button>}
    </div>{!fixedGroupId && <aside className="bet-sidebar"><div className="bet-panel bet-side-panel"><div className="bet-section-title"><h2>Tus grupos</h2><Users size={18} /></div>{groups.slice(0, 6).map((group) => <Link className="bet-side-group" key={group.id} to={`/groups/${group.id}`}><span className="bet-avatar bet-avatar-small">{group.name.slice(0, 1)}</span><span><strong>{group.name}</strong><small>{group.memberCount} integrantes</small></span><ArrowUpRight size={15} /></Link>)}{!groups.length && <p className="bet-muted">Armá tu grupo y pasales el código a tus amigos.</p>}<Link className="bet-side-link" to="/groups">Gestionar mis grupos <ArrowUpRight size={15} /></Link></div><div className="bet-panel bet-side-panel"><span className="bet-eyebrow">SEGUIMOS JUGANDO</span><h2>El Prode sigue acá.</h2><p>Tus pronósticos, posiciones y torneos, en el mismo lugar.</p><Link className="bet-side-link" to="/torneo"><Trophy size={16} /> Ir al Prode <ArrowUpRight size={15} /></Link><Link className="bet-side-link" to="/explorar"><Compass size={16} /> Explorar partidos <ArrowUpRight size={15} /></Link></div><p className="bet-side-note"><LockKeyhole size={14} /> Compartimos enlaces y opiniones. Los importes no se muestran y las apuestas se realizan fuera de esta web.</p></aside>}</div>
  </div>;
}
