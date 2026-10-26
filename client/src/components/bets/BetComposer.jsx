import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Link2, Loader2, LockKeyhole, Send, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import TicketDetail from './TicketDetail';

export default function BetComposer({ groups, fixedGroupId, onPublished, onClose }) {
  const [groupId, setGroupId] = useState(String(fixedGroupId || groups[0]?.id || ''));
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function read(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const { data } = await api.post('/community/imports', { sharedUrl: url.trim(), groupId: Number(groupId) }, { timeout: 25000 }); setPreview(data); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); }
  }
  async function publish(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const { data } = await api.post('/community/posts', { draftId: preview.id, groupId: Number(groupId), content }); onPublished(data); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); }
  }

  return <section className="bet-composer bet-panel" aria-label="Nueva apuesta compartida">
    <div className="bet-section-title"><div><span className="bet-eyebrow">COMPARTIR CON TU GRUPO</span><h2>Una apuesta, una conversación.</h2></div><button className="bet-icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar publicación"><X size={19} /></button></div>
    {!groups.length ? <div className="bet-empty"><p>Primero creá un grupo o unite con el código de tus amigos.</p><Link className="bet-button" to="/groups">Ir a mis grupos <ArrowRight size={16} /></Link></div> : <form onSubmit={preview ? publish : read}>
      <label className="bet-field">Grupo<select value={groupId} disabled={busy || !!fixedGroupId || !!preview} onChange={(e) => setGroupId(e.target.value)} required>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      {!preview ? <label className="bet-field">Enlace compartido de Stake<div className="bet-url-input"><Link2 size={18} /><input type="url" required maxLength={2048} placeholder="https://pba.stake.bet.ar/sports/…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} /></div><small>Copiá el enlace desde la opción Compartir de tu ticket.</small></label> : <>
        <div className="bet-notice" role="status">{preview.message}</div>
        <TicketDetail ticket={preview.ticket} originalUrl={preview.originalUrl} />
        <label className="bet-field">Tu comentario <span className="bet-muted">(opcional)</span><textarea rows={3} maxLength={2000} placeholder="¿Qué opinan de estas selecciones?" value={content} onChange={(e) => setContent(e.target.value)} disabled={busy} /><small>{content.length}/2000</small></label>
      </>}
      {error && <p role="alert" className="bet-error">{error}</p>}
      <div className="bet-composer-footer"><span><LockKeyhole size={14} /> Solo lo ven los integrantes del grupo.</span><div className="bet-actions">{preview && <button type="button" className="bet-button bet-button-quiet" disabled={busy} onClick={() => { setPreview(null); setError(''); }}>Cambiar enlace</button>}<button className="bet-button" disabled={busy || !groupId}>{busy ? <Loader2 size={16} className="animate-spin" /> : preview ? <Send size={16} /> : <ArrowRight size={16} />}{busy ? (preview ? 'Publicando…' : 'Leyendo enlace…') : preview ? (preview.ticket ? 'Publicar apuesta' : 'Publicar solo el enlace') : 'Ver vista previa'}</button></div></div>
    </form>}
  </section>;
}
