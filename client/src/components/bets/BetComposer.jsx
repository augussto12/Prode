import { useState } from 'react';
import { ArrowRight, Camera, Link2, Loader2, Plus, Send, Trash2, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import TicketDetail from './TicketDetail';

const blank = () => ({ event: '', team: '', player: '', pick: '', odds: '' });

export default function BetComposer({ groups, fixedGroupId, onPublished, onClose }) {
  const [groupId, setGroupId] = useState(String(fixedGroupId || ''));
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(null);
  const [totalOdds, setTotalOdds] = useState('');
  const [selections, setSelections] = useState([blank()]);
  const [scanned, setScanned] = useState(0);
  const [scanText, setScanText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosenGroup = groupId ? Number(groupId) : undefined;

  async function read(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const { data } = await api.post('/community/imports', { sharedUrl: url.trim(), ...(chosenGroup ? { groupId: chosenGroup } : {}) }, { timeout: 25000 }); setPreview(data); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); }
  }
  async function scan(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (files.length > 3) { setError('Elegí hasta 3 capturas por vez.'); return; }
    setBusy(true); setError('');
    try {
      const extracted = [];
      let foundOdds = '';
      const recognized = [];
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Cada captura debe ser JPG, PNG o WebP de hasta 5 MB.');
        const { data } = await api.post('/community/scan', file, { headers: { 'Content-Type': file.type }, timeout: 45000 });
        extracted.push(...data.selections);
        if (data.rawText) recognized.push(data.rawText);
        if (data.totalOdds) foundOdds = data.totalOdds;
      }
      if (!extracted.length && !recognized.length) throw new Error('No se pudo leer texto en la captura. Podés cargar las selecciones a mano.');
      if (extracted.length) setSelections((old) => [...(old.length === 1 && !old[0].event && !old[0].pick ? [] : old), ...extracted].slice(0, 40).map((item) => ({ ...blank(), ...item, team: item.team || '', player: item.player || '', odds: item.odds || '' })));
      setScanText((old) => [old, ...recognized].filter(Boolean).join('\n\n').slice(0, 6000));
      if (foundOdds) setTotalOdds(foundOdds);
      setScanned((value) => value + files.length);
    } catch (err) { setError(err.message && !err.response ? err.message : getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }
  function updateSelection(index, key, value) { setSelections((old) => old.map((row, i) => i === index ? { ...row, [key]: value } : row)); }
  async function publish(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const payload = { draftId: preview.id, ...(chosenGroup ? { groupId: chosenGroup } : {}), content };
      if (!preview.ticket) {
        payload.totalOdds = totalOdds.replace(',', '.');
        payload.selections = selections.map((row) => ({ event: row.event.trim(), team: row.team.trim() || null, player: row.player.trim() || null, pick: row.pick.trim(), odds: row.odds.trim() ? row.odds.replace(',', '.') : null }));
      }
      const { data } = await api.post('/community/posts', payload);
      onPublished(data);
    } catch (err) { setError(getApiErrorMessage(err)); } finally { setBusy(false); }
  }

  return <section className="bet-composer bet-panel" aria-label="Nueva apuesta compartida">
    <div className="bet-section-title"><div><span className="bet-eyebrow">COMPARTIR APUESTA</span><h2>Mostrá qué jugaste.</h2></div><button className="bet-icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={19} /></button></div>
    <form onSubmit={preview ? publish : read}>
      <label className="bet-field">¿Quién puede verla?<select value={groupId} disabled={busy || !!fixedGroupId || !!preview} onChange={(e) => setGroupId(e.target.value)}><option value="">Todos, en el inicio</option>{groups.map((group) => <option key={group.id} value={group.id}>Solo {group.name}</option>)}</select></label>
      {!preview ? <label className="bet-field">Enlace compartido de Stake<div className="bet-url-input"><Link2 size={18} /><input type="url" required maxLength={2048} placeholder="https://pba.stake.bet.ar/sports/…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} /></div><small>Pegá el enlace original. Después agregá las selecciones con capturas o a mano.</small></label> : <>
        <div className="bet-notice" role="status">{preview.ticket ? 'Detalle leído desde Stake. Revisalo antes de publicar.' : 'Stake no devolvió el detalle. Cargá las selecciones con capturas o a mano y revisalas antes de publicar.'}</div>
        {preview.ticket ? <TicketDetail ticket={preview.ticket} originalUrl={preview.originalUrl} /> : <>
          <label className="bet-upload"><Camera size={19} /><span>Leer capturas del ticket</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={scan} disabled={busy} /></label>
          <p className="bet-muted">Hasta 3 imágenes por vez. El texto se lee en nuestro servidor; revisá cada campo. La captura no se guarda ni se publica.</p>
          {scanned > 0 && <p className="bet-notice">Se leyeron {scanned} capturas. Corregí los datos que no coincidan con tu ticket.</p>}
          {scanText && <details className="bet-ocr-text"><summary>Ver texto leído de las capturas</summary><pre>{scanText}</pre><p>Si faltan datos en los campos, copialos desde este texto.</p></details>}
          <label className="bet-field">Cuota total del ticket<input required inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="Ej.: 27,08" value={totalOdds} onChange={(e) => setTotalOdds(e.target.value)} disabled={busy} /></label>
          <div className="bet-section-title"><h3>Selecciones</h3><button type="button" className="bet-button bet-button-quiet" disabled={busy || selections.length >= 40} onClick={() => setSelections((old) => [...old, blank()])}><Plus size={15} /> Agregar</button></div>
          {selections.map((row, index) => <div className="bet-manual-selection" key={index}>
            <div className="bet-section-title"><strong>Selección {index + 1}</strong>{selections.length > 1 && <button type="button" className="bet-icon-button" aria-label={`Quitar selección ${index + 1}`} onClick={() => setSelections((old) => old.filter((_, i) => i !== index))}><Trash2 size={15} /></button>}</div>
            <label className="bet-field">Partido<input required maxLength={200} placeholder="Warriors vs. Lakers" value={row.event} onChange={(e) => updateSelection(index, 'event', e.target.value)} /></label>
            <div className="bet-field-grid"><label className="bet-field">Equipo<input maxLength={100} placeholder="Warriors" value={row.team} onChange={(e) => updateSelection(index, 'team', e.target.value)} /></label><label className="bet-field">Jugador, si aplica<input maxLength={100} placeholder="Stephen Curry" value={row.player} onChange={(e) => updateSelection(index, 'player', e.target.value)} /></label></div>
            <div className="bet-field-grid"><label className="bet-field">Qué pusiste<input required maxLength={200} placeholder="Más de 4,5 triples" value={row.pick} onChange={(e) => updateSelection(index, 'pick', e.target.value)} /></label><label className="bet-field">Cuota de esta selección<input inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="1,85 (si figura)" value={row.odds} onChange={(e) => updateSelection(index, 'odds', e.target.value)} /></label></div>
          </div>)}
        </>}
        <label className="bet-field">Tu comentario <span className="bet-muted">(opcional)</span><textarea rows={3} maxLength={2000} placeholder="¿Qué opinan?" value={content} onChange={(e) => setContent(e.target.value)} disabled={busy} /></label>
      </>}
      {error && <p role="alert" className="bet-error">{error}</p>}
      <div className="bet-composer-footer"><span>{groupId ? 'Solo lo ven los integrantes del grupo.' : 'Esta apuesta será visible para todos en el inicio.'}</span><div className="bet-actions">{preview && <button type="button" className="bet-button bet-button-quiet" disabled={busy} onClick={() => { setPreview(null); setError(''); }}>Cambiar enlace</button>}<button className="bet-button" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : preview ? <Send size={16} /> : <ArrowRight size={16} />}{busy ? 'Procesando…' : preview ? 'Publicar apuesta' : 'Continuar'}</button></div></div>
    </form>
  </section>;
}
