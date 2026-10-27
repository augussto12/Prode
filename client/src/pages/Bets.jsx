import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, CirclePlus, RefreshCw, Search, Ticket, Trophy, Users } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api, { getApiErrorMessage } from '../services/api';
import BetComposer from '../components/bets/BetComposer';
import BetPost from '../components/bets/BetPost';
import { readShareInbox, SHARE_CACHE } from '../components/bets/shareInbox';
import HomeSwitch from '../components/bets/HomeSwitch';
import './bets.css';

export default function Bets({ home = false, groupId: fixedGroupId }) {
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [mode, setMode] = useState(params.get('view') === 'saved' ? 'saved' : params.get('view') === 'mine' ? 'mine' : 'all');
  const [scope, setScope] = useState(fixedGroupId ? 'groups' : 'public');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [composer, setComposer] = useState(false);
  const [sharedPayload, setSharedPayload] = useState(null);
  const [shareMessage, setShareMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  const groupId = fixedGroupId ? Number(fixedGroupId) : undefined;

  useEffect(() => {
    if (params.get('sharedError')) {
      setShareMessage('No pudimos recibir lo que compartiste. Probá de nuevo o pegá el enlace.');
      setParams((current) => { const next = new URLSearchParams(current); next.delete('sharedError'); return next; }, { replace: true });
    }
  }, [params, setParams]);
  useEffect(() => {
    if (!user || fixedGroupId || sharedPayload) return;
    let active = true;
    readShareInbox().then((payload) => {
      if (!active || !payload) return;
      setSharedPayload(payload);
      setComposer(true);
      setShareMessage('');
      if (params.has('shared')) setParams((current) => { const next = new URLSearchParams(current); next.delete('shared'); return next; }, { replace: true });
    }).catch((err) => { if (active) setShareMessage(err.message); });
    return () => { active = false; };
  }, [user, fixedGroupId, sharedPayload, params, setParams]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.get('/groups').then(({ data }) => { if (active) setGroups(data); }).catch((err) => { if (active) setError(getApiErrorMessage(err)); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    const current = ++requestId.current;
    setLoading(true); setError(''); setItems([]); setNextCursor(null);
    const path = user ? '/community/posts' : '/community/public';
    const options = { params: user ? { groupId, scope, mode, query } : { query } };
    api.get(path, options).then(({ data }) => { if (current === requestId.current) { setItems(data.items); setNextCursor(data.nextCursor); } }).catch((err) => { if (current === requestId.current) setError(getApiErrorMessage(err)); }).finally(() => { if (current === requestId.current) setLoading(false); });
    return () => { if (requestId.current === current) requestId.current = current + 1; };
  }, [user, groupId, scope, mode, query, refresh]);
  async function more() {
    setLoading(true); setError('');
    try { const { data } = await api.get(user ? '/community/posts' : '/community/public', { params: user ? { groupId, scope, mode, query, before: nextCursor } : { query, before: nextCursor } }); setItems((old) => [...old, ...data.items]); setNextCursor(data.nextCursor); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); }
  }
  function changeMode(value) { setMode(value); if (!fixedGroupId) setParams(value === 'all' ? {} : { view: value }, { replace: true }); }

  return <div className={`bets-page ${fixedGroupId ? 'bet-embedded' : ''}`}>
    {!fixedGroupId && <HomeSwitch active="bets" />}
    {!fixedGroupId && <section className="bet-hero bet-home-hero"><div className="bet-hero-copy"><span className="bet-eyebrow"><span className="bet-live-dot" /> APUESTAS ENTRE AMIGOS</span><h1>{home ? <>Las apuestas<br /><em>están acá.</em></> : <>Apuestas<br /><em>compartidas.</em></>}</h1><p>Encontrá qué jugaron, quién lo publicó, el partido, cada selección y las cuotas. Buscá por equipo o jugador.</p><div className="bet-actions">{user ? <button className="bet-button" onClick={() => setComposer(true)}><CirclePlus size={18} /> Subir apuesta</button> : <Link className="bet-button" to="/register"><CirclePlus size={18} /> Crear cuenta para publicar</Link>}<Link className="bet-button bet-button-quiet" to="/groups"><Users size={17} /> Grupos</Link></div></div><div className="bet-home-aside"><span className="bet-eyebrow">EN EL INICIO</span><strong>Partido.<br />Selección.<br /><span>Cuota.</span></strong><span className="bet-hero-note">Buscá Warriors, Curry o cualquier equipo y jugador.</span></div></section>}
    <div className="bet-layout"><div className="bet-feed-column">
      {shareMessage && <p className="bet-notice" role="status">{shareMessage}</p>}
      {!user && params.has('shared') && <p className="bet-notice">Ingresá a tu cuenta para publicar lo que compartiste. <Link to="/login">Ingresar</Link></p>}
      {user && (composer ? <BetComposer key={sharedPayload?.receivedAt || 'manual'} groups={fixedGroupId ? groups.filter((group) => group.id === groupId) : groups} fixedGroupId={fixedGroupId} initialShare={sharedPayload} onClose={() => { setComposer(false); setSharedPayload(null); if (sharedPayload) caches.delete(SHARE_CACHE); }} onPublished={(post) => { if (sharedPayload) caches.delete(SHARE_CACHE); setSharedPayload(null); setComposer(false); setMode('all'); setScope(post.group ? 'groups' : 'public'); setSearch(''); setQuery(''); setRefresh((value) => value + 1); }} /> : <button className="bet-composer-prompt bet-panel" onClick={() => setComposer(true)}><span className="bet-avatar">{(user.displayName || user.username).slice(0, 1)}</span><span>¿Qué apuesta querés compartir?</span><span className="bet-prompt-link"><CirclePlus size={17} /> Subir</span></button>)}
      <div className="bet-feed-toolbar"><div className="bet-feed-tabs" role="group" aria-label="Filtrar apuestas">{!fixedGroupId && <button className={scope === 'public' && mode === 'all' ? 'is-active' : ''} onClick={() => { setScope('public'); changeMode('all'); }}>Para todos</button>}{user && <>{!fixedGroupId && <button className={scope === 'groups' && mode === 'all' ? 'is-active' : ''} onClick={() => { setScope('groups'); changeMode('all'); }}>Mis grupos</button>}<button className={mode === 'mine' ? 'is-active' : ''} onClick={() => { setScope('all'); changeMode('mine'); }}><Ticket size={16} /> Mis apuestas</button><button className={mode === 'saved' ? 'is-active' : ''} onClick={() => { setScope('all'); changeMode('saved'); }}><Bookmark size={16} /> Guardadas</button></>}</div><button className="bet-icon-button" aria-label="Actualizar" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /></button></div>
      <form className="bet-search bet-search-main" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}><Search size={17} /><input aria-label="Buscar equipo, jugador o partido" placeholder="Equipo, jugador o partido…" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">Buscar</button>{query && <button type="button" onClick={() => { setSearch(''); setQuery(''); }}>Limpiar</button>}</form>
      {query && <p className="bet-muted">Mostrando las selecciones que coinciden con “{query}” y la cuota total de cada ticket.</p>}
      {error && <div className="bet-error" role="alert">{error}<button onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div>}
      {!loading && !error && !items.length && <div className="bet-empty bet-panel"><h2>{query ? 'No hay selecciones para esa búsqueda' : 'Todavía no hay apuestas acá'}</h2><p>{query ? 'Probá con otro equipo, jugador o partido.' : 'La primera apuesta pública va a aparecer en este inicio.'}</p>{user && <button className="bet-button" onClick={() => setComposer(true)}><CirclePlus size={16} /> Subir apuesta</button>}</div>}
      {items.map((post) => <BetPost key={post.id} post={post} userId={user?.id} filterQuery={query} onChange={(updated) => setItems((old) => old.flatMap((item) => item.id !== updated.id ? [item] : mode === 'saved' && !updated.saved ? [] : [updated]))} onDelete={(id) => setItems((old) => old.filter((item) => item.id !== id))} />)}
      {loading && <div className="bet-feed-skeleton" role="status" aria-label="Cargando apuestas"><div /><div /><div /></div>}
      {nextCursor && !loading && <button className="bet-button bet-button-quiet bet-load-more" onClick={more}>Ver más apuestas</button>}
    </div>{!fixedGroupId && <aside className="bet-sidebar"><div className="bet-panel bet-side-panel"><h2>Buscá entre las apuestas</h2><p>Si tres tickets incluyen a Warriors, vas a ver los tres con la selección y la cuota total de cada uno.</p><p>Las selecciones de capturas se revisan antes de publicarse. Los importes no se muestran.</p></div>{user && <div className="bet-panel bet-side-panel"><h2>Tus grupos</h2>{groups.slice(0, 6).map((group) => <Link className="bet-side-group" key={group.id} to={`/groups/${group.id}`}><span className="bet-avatar bet-avatar-small">{group.name.slice(0, 1)}</span><span><strong>{group.name}</strong><small>{group.memberCount} integrantes</small></span></Link>)}<Link className="bet-side-link" to="/groups">Ver grupos</Link></div>}<div className="bet-panel bet-side-panel"><h2>El Prode sigue acá</h2><Link className="bet-side-link" to="/torneo"><Trophy size={16} /> Ir al Prode</Link></div></aside>}</div>
  </div>;
}
