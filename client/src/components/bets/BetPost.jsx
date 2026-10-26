import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MessageCircle, Heart, Copy, Check, Trash2, Pencil, Flag, Send, Loader2 } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import useToastStore from '../../store/toastStore';
import TicketDetail from './TicketDetail';

const when = (date) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
export default function BetPost({ post, userId, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(post.content);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);
  const [reports, setReports] = useState(null);
  async function act(fn) { setBusy(true); setError(''); try { await fn(); } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); } }
  const toggle = (type, active) => act(async () => { const { data } = await api.put(`/community/posts/${post.id}/${type}`, { active }); onChange(data); });
  async function loadComments(more = false) {
    setLoadingComments(true); setError('');
    try { const { data } = await api.get(`/community/posts/${post.id}/comments`, { params: more && cursor ? { after: cursor } : {} }); setComments((old) => more ? [...old, ...data.items] : data.items); setCursor(data.nextCursor); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setLoadingComments(false); }
  }
  function remove() { useToastStore.getState().askConfirm({ title: 'Eliminar publicación', message: 'Se eliminarán esta publicación y sus comentarios del grupo.', confirmText: 'Eliminar', onConfirm: () => act(async () => { await api.delete(`/community/posts/${post.id}`); onDelete(post.id); }) }); }
  async function addComment(event) {
    event.preventDefault();
    await act(async () => { await api.post(`/community/posts/${post.id}/comments`, { content: text }); setText(''); await loadComments(); const { data } = await api.get(`/community/posts/${post.id}`); onChange(data); });
  }
  return <article className="bet-post bet-panel">
    <header className="bet-post-header"><div className="bet-avatar">{(post.author.displayName || post.author.username).slice(0, 2).toUpperCase()}</div><div className="bet-post-author"><strong>{post.author.displayName}</strong><span><Link to={`/groups/${post.group.id}`}>{post.group.name}</Link><span> · {when(post.createdAt)}</span></span></div><span className="bet-private-label">Grupo privado</span></header>
    {editing ? <form className="bet-edit" onSubmit={(e) => { e.preventDefault(); act(async () => { const { data } = await api.patch(`/community/posts/${post.id}`, { content: edited }); onChange(data); setEditing(false); }); }}><label className="bet-field">Editar comentario<textarea value={edited} onChange={(e) => setEdited(e.target.value)} maxLength={2000} /></label><div className="bet-actions"><button type="button" className="bet-button bet-button-quiet" onClick={() => setEditing(false)}>Cancelar</button><button className="bet-button" disabled={busy}>Guardar cambios</button></div></form> : post.content && <p className="bet-post-text">{post.content}</p>}
    <TicketDetail ticket={post.ticket} originalUrl={post.originalUrl} />
    <div className="bet-post-actions"><button disabled={busy} aria-pressed={post.reacted} className={post.reacted ? 'is-selected' : ''} onClick={() => toggle('reaction', !post.reacted)}><Heart size={17} fill={post.reacted ? 'currentColor' : 'none'} /> {post.reactionCount}<span>Me interesa</span></button><button aria-expanded={open} onClick={() => { setOpen(!open); if (!open) loadComments(); }}><MessageCircle size={17} /> {post.commentCount}<span>Comentarios</span></button><button disabled={busy} aria-pressed={post.saved} className={post.saved ? 'is-selected' : ''} onClick={() => toggle('save', !post.saved)}><Bookmark size={17} fill={post.saved ? 'currentColor' : 'none'} /><span>{post.saved ? 'Guardado' : 'Guardar'}</span></button><button title="Copiar enlace original" aria-label="Copiar enlace original" onClick={async () => { try { await navigator.clipboard.writeText(post.originalUrl); setCopied(true); } catch { setError('No se pudo copiar. Podés abrir el enlace original y copiarlo desde el navegador.'); } }}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
    <div className="bet-post-tools">{post.canEdit && <button disabled={busy} onClick={() => { setEdited(post.content); setEditing(!editing); }}><Pencil size={12} /> Editar texto</button>}{post.canDelete && <button disabled={busy} onClick={remove}><Trash2 size={12} /> Eliminar</button>}<button onClick={() => setReporting(!reporting)}><Flag size={12} /> Reportar</button>{post.reportCount > 0 && <button onClick={() => act(async () => { const { data } = await api.get(`/community/posts/${post.id}/reports`); setReports(data); })}><Flag size={12} /> {post.reportCount} reportes</button>}</div>
    {reports && <div className="bet-notice"><strong>Reportes para moderación</strong>{reports.map((report) => <p key={report.id}>{report.reason}</p>)}<button className="bet-button bet-button-quiet" onClick={() => setReports(null)}>Cerrar</button></div>}
    {reporting && <form className="bet-comment-form" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.post(`/community/posts/${post.id}/reports`, { reason }); setReporting(false); setReason(''); useToastStore.getState().addToast({ type: 'success', message: 'Reporte enviado a los administradores del grupo.' }); }); }}><label className="bet-field">Motivo del reporte<input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={500} required /></label><button className="bet-button bet-button-quiet" disabled={busy}>Enviar reporte</button></form>}
    {error && <p className="bet-error" role="alert">{error}</p>}
    {open && <section className="bet-comments" aria-label="Comentarios">
      {comments.map((comment) => <div className="bet-comment" key={comment.id}><div className="bet-avatar bet-avatar-small">{comment.author.displayName.slice(0, 1)}</div><div><strong>{comment.author.displayName}<small>{when(comment.createdAt)}</small></strong><p>{comment.content}</p></div>{(comment.author.id === userId || post.reportCount !== undefined) && <button className="bet-icon-button" aria-label="Eliminar comentario" disabled={busy} onClick={() => act(async () => { await api.delete(`/community/posts/${post.id}/comments/${comment.id}`); await loadComments(); const { data } = await api.get(`/community/posts/${post.id}`); onChange(data); })}><Trash2 size={13} /></button>}</div>)}
      {loadingComments && <p className="bet-muted" role="status">Cargando comentarios…</p>}
      {!comments.length && !loadingComments && <p className="bet-muted">Todavía no hay comentarios. Empezá la conversación.</p>}
      {cursor && <button disabled={loadingComments} className="bet-button bet-button-quiet" onClick={() => loadComments(true)}>Ver más comentarios</button>}
      <form className="bet-comment-form" onSubmit={addComment}><label className="sr-only" htmlFor={`comment-${post.id}`}>Escribí un comentario</label><input id={`comment-${post.id}`} value={text} onChange={(e) => setText(e.target.value)} required maxLength={1000} placeholder="Escribí un comentario…" /><button className="bet-button" disabled={busy || !text.trim()} aria-label="Enviar comentario">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button></form>
    </section>}
  </article>;
}
