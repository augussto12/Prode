import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Link2, Loader2, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import TicketDetail from './TicketDetail';
import BetCaptureGallery from './BetCaptureGallery';

const blank = () => ({ event: '', team: '', player: '', pick: '', odds: '' });
const showOdds = (value) => value ? String(value).replace('.', ',') : 'No detectada';

export default function BetComposer({ groups, fixedGroupId, onPublished, onClose }) {
  const [groupId, setGroupId] = useState(String(fixedGroupId || ''));
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(null);
  const [totalOdds, setTotalOdds] = useState('');
  const [selections, setSelections] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const imageUrls = useRef([]);
  useEffect(() => () => imageUrls.current.forEach((value) => URL.revokeObjectURL(value)), []);
  const chosenGroup = groupId ? Number(groupId) : undefined;
  const captured = captures.length > 0;

  async function read(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post('/community/imports', { sharedUrl: url.trim(), ...(chosenGroup ? { groupId: chosenGroup } : {}) }, { timeout: 25000 });
      setPreview(data);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  async function scan(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (files.length + captures.length > 3) { setError('Podés subir hasta 3 capturas por ticket.'); return; }
    setBusy(true); setError('');
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Cada captura debe ser JPG, PNG o WebP de hasta 5 MB.');
        const { data } = await api.post('/community/scan', file, { params: { draftId: preview.id }, headers: { 'Content-Type': file.type }, timeout: 45000 });
        const imageUrl = URL.createObjectURL(file);
        imageUrls.current.push(imageUrl);
        setCaptures((old) => [...old, { id: data.id, src: imageUrl }]);
        if (data.totalOdds) setTotalOdds(data.totalOdds);
        if (data.selections?.length) setSelections((old) => {
          const merged = [...old, ...data.selections.map((item) => ({ ...blank(), ...item, team: item.team || '', player: item.player || '', odds: item.odds || '' }))];
          const seen = new Set();
          return merged.filter((item) => { const key = [item.event, item.player, item.pick].join('|').toLocaleLowerCase('es'); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 40);
        });
      }
    } catch (err) { setError(err.message && !err.response ? err.message : getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  function updateSelection(index, key, value) {
    setSelections((old) => old.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }
  async function publish(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const payload = { draftId: preview.id, ...(chosenGroup ? { groupId: chosenGroup } : {}), content };
      if (!preview.ticket) {
        if (totalOdds.trim()) payload.totalOdds = totalOdds.trim().replace(',', '.');
        const complete = selections.filter((row) => row.event.trim() && row.pick.trim());
        if (complete.length) payload.selections = complete.map((row) => ({ event: row.event.trim(), team: row.team.trim() || null, player: row.player.trim() || null, pick: row.pick.trim(), odds: row.odds.trim() ? row.odds.trim().replace(',', '.') : null }));
      }
      const { data } = await api.post('/community/posts', payload);
      onPublished(data);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  function changeLink() {
    imageUrls.current.forEach((value) => URL.revokeObjectURL(value));
    imageUrls.current = [];
    setPreview(null); setCaptures([]); setSelections([]); setTotalOdds(''); setEditing(false); setError('');
  }

  return <section className="bet-composer bet-panel" aria-label="Nueva apuesta compartida">
    <div className="bet-section-title"><div><span className="bet-eyebrow">COMPARTIR APUESTA</span><h2>Mostrá tu ticket.</h2></div><button type="button" className="bet-icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={19} /></button></div>
    <form onSubmit={preview ? publish : read}>
      <label className="bet-field">¿Quién puede verla?<select value={groupId} disabled={busy || !!fixedGroupId || !!preview} onChange={(event) => setGroupId(event.target.value)}><option value="">Todos, en el inicio</option>{groups.map((group) => <option key={group.id} value={group.id}>Solo {group.name}</option>)}</select></label>
      {!preview ? <label className="bet-field">Enlace compartido de Stake<div className="bet-url-input"><Link2 size={18} /><input type="url" required maxLength={2048} placeholder="https://pba.stake.bet.ar/sports/…" value={url} onChange={(event) => setUrl(event.target.value)} disabled={busy} /></div><small>Pegá el enlace. En el siguiente paso subís las capturas.</small></label> : <>
        {preview.ticket ? <TicketDetail ticket={preview.ticket} originalUrl={preview.originalUrl} /> : <>
          <label className="bet-upload"><Camera size={20} /><span>{captured ? 'Agregar otra captura' : 'Subir capturas del ticket'}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={scan} disabled={busy || captures.length >= 3} /></label>
          <p className="bet-muted">Las capturas se guardan con la apuesta y se ven al publicarla. Revisá si muestran importes o datos personales.</p>
          {captured && <BetCaptureGallery images={captures} />}
          {(captured || selections.length > 0) && <div className="bet-ticket bet-read-preview"><div className="bet-ticket-top"><span className="bet-provider">VISTA PREVIA</span><span className="bet-label">Leído de capturas</span></div><div className="bet-ticket-summary"><div><span>{selections.length ? `${selections.length} selecciones reconocidas` : 'Detalle en las capturas'}</span><small>Revisá la vista antes de publicar</small></div><div className="bet-odds"><small>Cuota total</small><strong>{showOdds(totalOdds)}</strong></div></div>{selections.length > 0 && <div className="bet-selection-list">{selections.filter((row) => row.event && row.pick).map((row, index) => <div className="bet-manual-row" key={`${row.event}-${row.pick}-${index}`}><div><strong>{row.event}</strong><span>{[row.team, row.player].filter(Boolean).join(' · ')}</span><p>{row.pick}</p></div><b>{row.odds ? `Cuota ${showOdds(row.odds)}` : 'Cuota no detectada'}</b></div>)}</div>}</div>}
          {!captured && !selections.length && <div className="bet-notice">Subí las capturas para ver tu ticket. También podés cargar los datos manualmente.</div>}
          <button type="button" className="bet-button bet-button-quiet bet-edit-details" onClick={() => setEditing(!editing)}><Pencil size={15} /> {editing ? 'Ocultar edición' : 'Corregir o agregar datos'}</button>
          {editing && <div className="bet-edit-fields"><label className="bet-field">Cuota total del ticket<input inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="Ej.: 27,08" value={totalOdds} onChange={(event) => setTotalOdds(event.target.value)} /></label><div className="bet-section-title"><h3>Selecciones</h3><button type="button" className="bet-button bet-button-quiet" disabled={selections.length >= 40} onClick={() => setSelections((old) => [...old, blank()])}><Plus size={15} /> Agregar selección</button></div>{selections.map((row, index) => <div className="bet-manual-selection" key={index}><div className="bet-section-title"><strong>Selección {index + 1}</strong><button type="button" className="bet-icon-button" aria-label={`Quitar selección ${index + 1}`} onClick={() => setSelections((old) => old.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div><label className="bet-field">Partido<input maxLength={200} placeholder="Warriors vs. Lakers" value={row.event} onChange={(event) => updateSelection(index, 'event', event.target.value)} /></label><div className="bet-field-grid"><label className="bet-field">Equipo<input maxLength={100} placeholder="Warriors" value={row.team} onChange={(event) => updateSelection(index, 'team', event.target.value)} /></label><label className="bet-field">Jugador<input maxLength={100} placeholder="Stephen Curry" value={row.player} onChange={(event) => updateSelection(index, 'player', event.target.value)} /></label></div><div className="bet-field-grid"><label className="bet-field">Qué pusiste<input maxLength={200} placeholder="Más de 4,5 triples" value={row.pick} onChange={(event) => updateSelection(index, 'pick', event.target.value)} /></label><label className="bet-field">Cuota individual<input inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="1,85" value={row.odds} onChange={(event) => updateSelection(index, 'odds', event.target.value)} /></label></div></div>)}</div>}
        </>}
        <label className="bet-field">Tu comentario <span className="bet-muted">(opcional)</span><textarea rows={3} maxLength={2000} placeholder="¿Qué opinan?" value={content} onChange={(event) => setContent(event.target.value)} disabled={busy} /></label>
      </>}
      {error && <p role="alert" className="bet-error">{error}</p>}
      <div className="bet-composer-footer"><span>{groupId ? 'Solo lo ven los integrantes del grupo.' : 'Esta apuesta será visible para todos en el inicio.'}</span><div className="bet-actions">{preview && <button type="button" className="bet-button bet-button-quiet" disabled={busy} onClick={changeLink}>Cambiar enlace</button>}<button className="bet-button" disabled={busy || (!!preview && !preview.ticket && !captured && !selections.some((row) => row.event && row.pick))}>{busy ? <Loader2 size={16} className="animate-spin" /> : preview ? <Send size={16} /> : <ArrowRight size={16} />}{busy ? 'Procesando…' : preview ? 'Publicar apuesta' : 'Continuar'}</button></div></div>
    </form>
  </section>;
}
