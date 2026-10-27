import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Flag, Heart, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import useToastStore from '../../store/toastStore';
import TicketDetail from './TicketDetail';
import BetCaptureGallery from './BetCaptureGallery';

const when = (date) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
const odds = (value) => value ? String(value).replace('.', ',') : '—';

export default function BetPost({ post, userId, filterQuery, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(post.content);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [reports, setReports] = useState(null);
  const matched = filterQuery ? post.selections.filter((selection) => [selection.event, selection.team, selection.player, selection.pick].some((value) => value?.toLocaleLowerCase('es').includes(filterQuery.toLocaleLowerCase('es')))) : [];
  const shownSelections = matched.length ? matched : post.selections;
  async function act(fn) { setBusy(true); setError(''); try { await fn(); } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); } }
  async function loadComments(more = false) {
    const { data } = await api.get(`/community/posts/${post.id}/comments`, { params: more && cursor ? { after: cursor } : {} });
    setComments((old) => more ? [...old, ...data.items] : data.items);
    setCursor(data.nextCursor);
  }
  const toggle = (type, active) => act(async () => { const { data } = await api.put(`/community/posts/${post.id}/${type}`, { active }); onChange(data); });
  function remove() { useToastStore.getState().askConfirm({ title: 'Eliminar publicación', message: 'Se eliminarán esta apuesta y sus comentarios.', confirmText: 'Eliminar', onConfirm: () => act(async () => { await api.delete(`/community/posts/${post.id}`); onDelete(post.id); }) }); }
  async function addComment(event) { event.preventDefault(); await act(async () => { await api.post(`/community/posts/${post.id}/comments`, { content: text }); setText(''); await loadComments(); const { data } = await api.get(`/community/posts/${post.id}`); onChange(data); }); }

  return <article className="bet-post bet-panel">
    <header className="bet-post-header"><div className="bet-avatar">{(post.author.displayName || post.author.username).slice(0, 2).toUpperCase()}</div><div className="bet-post-author"><strong>{post.author.displayName || post.author.username}</strong><span>{post.group ? <Link to={`/groups/${post.group.id}`}>{post.group.name}</Link> : 'Público'} · {when(post.createdAt)}</span></div><span className="bet-private-label">{post.group ? 'Grupo privado' : 'En el inicio'}</span></header>
    {editing ? <form className="bet-edit" onSubmit={(event) => { event.preventDefault(); act(async () => { const { data } = await api.patch(`/community/posts/${post.id}`, { content: edited }); onChange(data); setEditing(false); }); }}><label className="bet-field">Editar comentario<textarea value={edited} onChange={(event) => setEdited(event.target.value)} maxLength={2000} /></label><div className="bet-actions"><button type="button" className="bet-button bet-button-quiet" onClick={() => setEditing(false)}>Cancelar</button><button className="bet-button" disabled={busy}>Guardar</button></div></form> : post.content && <p className="bet-post-text">{post.content}</p>}
    {post.importState === 'author_entered' || post.importState === 'screenshot' || (filterQuery && matched.length) ? <div className="bet-ticket"><div className="bet-ticket-top"><span className="bet-provider">STAKE PBA</span><span className="bet-label">{post.importState === 'ready' ? 'Datos importados' : post.importState === 'screenshot' ? 'Ticket con capturas' : 'Datos cargados por el autor'}</span></div><div className="bet-ticket-summary"><div><span>{shownSelections.length ? `${shownSelections.length} ${filterQuery && matched.length ? 'coincidencias' : 'selecciones'}` : 'Detalle en las capturas'}</span><small>Resultado sin verificar</small></div><div className="bet-odds"><small>Cuota total del ticket</small><strong>{odds(post.totalOdds)}</strong></div></div>{shownSelections.length > 0 && <div className="bet-selection-list">{shownSelections.map((selection, index) => <div className="bet-manual-row" key={index}><div><strong>{selection.event}</strong><span>{[selection.team, selection.player].filter(Boolean).join(' · ')}</span><p>{selection.pick}</p></div><b>{selection.odds ? `Cuota ${odds(selection.odds)}` : 'Cuota no detectada'}</b></div>)}</div>}<a className="bet-external" href={post.originalUrl} target="_blank" rel="noopener noreferrer">Ver enlace original ↗</a></div> : <TicketDetail ticket={post.ticket} originalUrl={post.originalUrl} />}
    <BetCaptureGallery images={(post.screenshots || []).map((id) => ({ id, src: post.group ? `/api/community/images/${id}` : `/api/community/public/images/${id}` }))} />
    <div className="bet-post-actions"><button disabled={!userId || busy} aria-pressed={post.reacted} onClick={() => toggle('reaction', !post.reacted)}><Heart size={17} fill={post.reacted ? 'currentColor' : 'none'} /> {post.reactionCount}<span>Me interesa</span></button><button disabled={!userId} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) act(() => loadComments()); }}><MessageCircle size={17} /> {post.commentCount}<span>Comentarios</span></button><button disabled={!userId || busy} aria-pressed={post.saved} onClick={() => toggle('save', !post.saved)}><Bookmark size={17} fill={post.saved ? 'currentColor' : 'none'} /><span>{post.saved ? 'Guardado' : 'Guardar'}</span></button></div>
    <div className="bet-post-tools">{post.canEdit && <button disabled={busy} onClick={() => { setEdited(post.content); setEditing(!editing); }}><Pencil size={12} /> Editar texto</button>}{post.canDelete && <button disabled={busy} onClick={remove}><Trash2 size={12} /> Eliminar</button>}{userId && <button onClick={() => setReporting(!reporting)}><Flag size={12} /> Reportar</button>}{post.reportCount > 0 && <button onClick={() => act(async () => { const { data } = await api.get(`/community/posts/${post.id}/reports`); setReports(data); })}><Flag size={12} /> {post.reportCount} reportes</button>}</div>
    {reports && <div className="bet-notice"><strong>Reportes para moderación</strong>{reports.map((report) => <p key={report.id}>{report.reason}</p>)}<button className="bet-button bet-button-quiet" onClick={() => setReports(null)}>Cerrar</button></div>}
    {reporting && <form className="bet-comment-form" onSubmit={(event) => { event.preventDefault(); act(async () => { await api.post(`/community/posts/${post.id}/reports`, { reason }); setReason(''); setReporting(false); useToastStore.getState().addToast({ type: 'success', message: 'Reporte enviado.' }); }); }}><label className="bet-field">Motivo del reporte<input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} required /></label><button className="bet-button bet-button-quiet" disabled={busy}>Enviar</button></form>}
    {error && <p className="bet-error" role="alert">{error}</p>}
    {open && <section className="bet-comments" aria-label="Comentarios">{comments.map((comment) => <div className="bet-comment" key={comment.id}><div className="bet-avatar bet-avatar-small">{comment.author.displayName.slice(0, 1)}</div><div><strong>{comment.author.displayName}<small>{when(comment.createdAt)}</small></strong><p>{comment.content}</p></div>{(comment.author.id === userId || post.reportCount !== undefined) && <button className="bet-icon-button" aria-label="Eliminar comentario" onClick={() => act(async () => { await api.delete(`/community/posts/${post.id}/comments/${comment.id}`); await loadComments(); const { data } = await api.get(`/community/posts/${post.id}`); onChange(data); })}><Trash2 size={13} /></button>}</div>)}{cursor && <button className="bet-button bet-button-quiet" onClick={() => act(() => loadComments(true))}>Ver más</button>}<form className="bet-comment-form" onSubmit={addComment}><input value={text} onChange={(e) => setText(e.target.value)} required maxLength={1000} placeholder="Escribí un comentario…" /><button className="bet-button" disabled={busy || !text.trim()} aria-label="Enviar comentario"><Send size={16} /></button></form></section>}
  </article>;
}
