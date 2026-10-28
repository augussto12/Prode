import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Link2, Loader2, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import TicketDetail from './TicketDetail';
import SelectionGroups, { groupSelections, showOdds } from './SelectionGroups';
import { providerForUrl, sharedBetUrl } from './shareInbox';

const MAX_CAPTURES = 5;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const blank = () => ({ event: '', startsAt: '', team: '', player: '', pick: '', odds: '', groupOdds: null });
const providers = { auto: 'Detectar sola', stake_pba: 'Stake PBA', bet365: 'Bet365', betano: 'Betano' };
const toRows = (items) => (items || []).map((item) => ({ ...blank(), ...item, startsAt: item.startsAt || '', team: item.team || '', player: item.player || '', odds: item.odds || '', groupOdds: item.groupOdds || null }));

export default function BetComposer({ groups, fixedGroupId, initialShare, onPublished, onClose }) {
  const [groupId, setGroupId] = useState(String(fixedGroupId || ''));
  const initialUrl = sharedBetUrl(initialShare?.url) || sharedBetUrl(initialShare?.text) || sharedBetUrl(initialShare?.title);
  const [url, setUrl] = useState(initialUrl);
  const [provider, setProvider] = useState(providerForUrl(initialUrl) || 'auto');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(null);
  const [totalOdds, setTotalOdds] = useState('');
  const [expectedSelections, setExpectedSelections] = useState(null);
  const [selections, setSelections] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [readSource, setReadSource] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const imageUrls = useRef([]);
  useEffect(() => () => imageUrls.current.forEach((value) => URL.revokeObjectURL(value)), []);
  const chosenGroup = groupId ? Number(groupId) : undefined;
  const captured = captures.length > 0;
  const complete = selections.filter((row) => row.event?.trim() && row.pick?.trim());
  const previewGroups = groupSelections(complete);
  const missingSelections = expectedSelections && complete.length < expectedSelections ? expectedSelections - complete.length : 0;
  const incomplete = complete.filter((row) => !row.player && !row.team).length;

  function applyReading(data) {
    if (data.provider && data.provider !== 'auto') setProvider(data.provider);
    setTotalOdds(data.totalOdds ? String(data.totalOdds).replace('.', ',') : '');
    setExpectedSelections(data.expectedSelections || null);
    setSelections(toRows(data.selections));
    setReadSource(data.source || null);
    if (data.ocrFailed) setError('Alguna captura no se pudo leer automáticamente. Probá con una imagen más nítida o completá los datos a mano.');
  }

  async function makePreview(selectedProvider, selectedUrl) {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/community/imports', { provider: selectedProvider, ...(selectedUrl.trim() ? { sharedUrl: selectedUrl.trim() } : {}), ...(chosenGroup ? { groupId: chosenGroup } : {}) }, { timeout: 25000 });
      setPreview(data);
      if (data.provider) setProvider(data.provider);
      if (initialShare?.files?.length && !data.ticket) await scanFiles(initialShare.files, data.id);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  async function scanFiles(files, draftId) {
    const images = files.filter((file) => IMAGE_TYPES.includes(file.type));
    if (!images.length) { setError('Elegí capturas JPG, PNG o WebP.'); return; }
    const room = MAX_CAPTURES - captures.length;
    if (room <= 0) { setError(`Ya tenés ${MAX_CAPTURES} capturas. Quitá una para subir otra.`); return; }
    setBusy(true); setError('');
    const queue = images.slice(0, room);
    try {
      for (const [index, file] of queue.entries()) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`"${file.name}" pesa más de 5 MB.`);
        setReading(queue.length > 1 ? `Leyendo captura ${index + 1} de ${queue.length}…` : 'Leyendo la captura…');
        const { data } = await api.post('/community/scan', file, { params: { draftId }, headers: { 'Content-Type': file.type }, timeout: 60000 });
        const imageUrl = URL.createObjectURL(file);
        imageUrls.current.push(imageUrl);
        setCaptures((old) => [...old, { id: data.id, src: imageUrl }]);
        applyReading(data);
      }
      if (images.length > room) setError(`Se subieron ${room}; el máximo es ${MAX_CAPTURES} capturas por ticket.`);
    } catch (err) { setError(err.message && !err.response ? err.message : getApiErrorMessage(err)); }
    finally { setBusy(false); setReading(''); }
  }

  async function removeCapture(capture) {
    setBusy(true); setError(''); setReading('Actualizando la lectura…');
    try {
      const { data } = await api.delete(`/community/scan/${capture.id}`, { params: { draftId: preview.id }, timeout: 60000 });
      URL.revokeObjectURL(capture.src);
      setCaptures((old) => old.filter((item) => item.id !== capture.id));
      applyReading(data);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); setReading(''); }
  }

  // Ctrl+V of a screenshot straight from the clipboard while the upload step is open.
  useEffect(() => {
    if (!preview || preview.ticket) return undefined;
    const onPaste = (event) => {
      const files = Array.from(event.clipboardData?.files || []).filter((file) => IMAGE_TYPES.includes(file.type));
      if (!files.length || busy) return;
      event.preventDefault();
      scanFiles(files, preview.id);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  async function pasteLink() {
    try {
      const copied = sharedBetUrl(await navigator.clipboard.readText());
      if (!copied) throw new Error('No hay un enlace en el portapapeles. Copialo desde la casa de apuestas.');
      const detected = providerForUrl(copied);
      if (!detected) throw new Error('El enlace debe ser de Stake PBA, Bet365 o Betano.');
      setProvider(detected);
      setUrl(copied);
      setError('');
      await makePreview(detected, copied);
    } catch (err) { setError(err.name === 'NotAllowedError' ? 'El navegador no permitió leer el portapapeles. Mantené presionado el campo y elegí Pegar.' : err.message); }
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
        if (complete.length) payload.selections = complete.map((row) => ({ event: row.event.trim(), startsAt: row.startsAt?.trim() || null, team: row.team.trim() || null, player: row.player.trim() || null, pick: row.pick.trim(), odds: String(row.odds).trim() ? String(row.odds).trim().replace(',', '.') : null, groupOdds: row.groupOdds || null }));
      }
      const { data } = await api.post('/community/posts', payload);
      onPublished(data);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  function restart() {
    imageUrls.current.forEach((value) => URL.revokeObjectURL(value));
    imageUrls.current = [];
    setPreview(null); setCaptures([]); setSelections([]); setTotalOdds(''); setExpectedSelections(null); setReadSource(null); setEditing(false); setError('');
  }

  const canPublish = !!preview && (preview.ticket || captured || complete.length > 0 || preview.originalUrl?.startsWith('https://'));

  return <section className="bet-composer bet-panel" aria-label="Nueva apuesta compartida">
    <div className="bet-section-title">
      <div><span className="bet-eyebrow">COMPARTIR APUESTA</span><h2>{preview ? 'Revisá y publicá' : 'Mostrá tu ticket'}</h2></div>
      <button type="button" className="bet-icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={19} /></button>
    </div>
    <ol className="bet-steps" aria-label="Pasos">
      <li className={preview ? 'is-done' : 'is-current'}><span>{preview ? <CheckCircle2 size={14} /> : 1}</span> Casa y grupo</li>
      <li className={preview ? 'is-current' : ''}><span>2</span> Capturas y revisión</li>
    </ol>
    <form onSubmit={preview ? publish : (event) => { event.preventDefault(); makePreview(provider, url); }}>
      {!preview ? <>
        <div className="bet-field">Casa de apuestas <span className="bet-muted">(se reconoce sola por el enlace o la captura)</span>
          <div className="bet-chips" role="radiogroup" aria-label="Casa de apuestas">{Object.entries(providers).map(([key, name]) => <button type="button" role="radio" aria-checked={provider === key} key={key} className={provider === key ? 'is-active' : ''} disabled={busy} onClick={() => { setProvider(key); if (providerForUrl(url) !== key) setUrl(''); }}>{name}</button>)}</div>
        </div>
        <label className="bet-field">¿Quién puede verla?<select value={groupId} disabled={busy || !!fixedGroupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Todos, en el inicio</option>{groups.map((group) => <option key={group.id} value={group.id}>Solo {group.name}</option>)}</select></label>
        <label className="bet-field">Enlace del ticket <span className="bet-muted">(opcional)</span>
          <div className="bet-url-input"><Link2 size={18} /><input type="url" maxLength={2048} placeholder="Pegá el enlace de Stake, Bet365 o Betano" value={url} onChange={(event) => { setUrl(event.target.value); const detected = providerForUrl(event.target.value); if (detected) setProvider(detected); }} disabled={busy} /><button type="button" className="bet-inline-button" onClick={pasteLink} disabled={busy}>Pegar</button></div>
          <small>Con el enlace tus amigos pueden copiar la apuesta y evitamos tickets duplicados.</small>
        </label>
        {initialShare?.files?.length ? <p className="bet-notice">Recibimos {initialShare.files.length} {initialShare.files.length === 1 ? 'captura' : 'capturas'}. Al continuar se leen automáticamente.</p> : null}
      </> : <>
        {preview.ticket ? <TicketDetail ticket={preview.ticket} originalUrl={preview.originalUrl} /> : <>
          <label className={`bet-dropzone ${dragging ? 'is-dragging' : ''} ${captures.length >= MAX_CAPTURES ? 'is-full' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) scanFiles(Array.from(event.dataTransfer.files || []), preview.id); }}>
            {reading ? <Loader2 size={26} className="animate-spin" /> : <ImagePlus size={26} />}
            <strong>{reading || (captures.length >= MAX_CAPTURES ? 'Llegaste al máximo de capturas' : captured ? 'Agregar otra captura' : 'Subí las capturas del ticket')}</strong>
            <small>{reading ? 'Puede tardar unos segundos.' : `Tocá, arrastrá o pegá con Ctrl+V · ${captures.length}/${MAX_CAPTURES}`}</small>
            <input type="file" accept={IMAGE_TYPES.join(',')} multiple onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; scanFiles(files, preview.id); }} disabled={busy || captures.length >= MAX_CAPTURES} />
          </label>
          {captured && <div className="bet-thumbs">{captures.map((capture, index) => <figure key={capture.id}><img src={capture.src} alt={`Captura ${index + 1}`} /><button type="button" onClick={() => removeCapture(capture)} disabled={busy} aria-label={`Quitar captura ${index + 1}`}><X size={13} /></button></figure>)}</div>}
          {captured && <p className="bet-muted bet-small">Si una selección aparece en dos capturas se cuenta una sola vez. Las capturas se publican con la apuesta: revisá que no muestren datos personales.</p>}

          {(captured || complete.length > 0) && <div className="bet-ticket bet-read-preview">
            <div className="bet-ticket-top"><span className="bet-provider">{provider === 'auto' ? 'CASA SIN DETECTAR' : providers[provider].toUpperCase()}</span><span className="bet-label">Leído de capturas</span></div>
            <div className="bet-ticket-summary"><div><span>{complete.length ? `${complete.length}${expectedSelections ? ` de ${expectedSelections}` : ''} ${complete.length === 1 ? 'selección' : 'selecciones'}` : 'No reconocimos selecciones'}</span><small>{[...new Set(complete.map((row) => row.event))].join(' · ') || 'Completalas a mano con “Corregir”'}</small></div><div className="bet-odds"><small>Cuota total</small><strong>{showOdds(totalOdds.replace(',', '.'))}</strong></div></div>
            {(missingSelections > 0 || !totalOdds || incomplete > 0) && !reading && <ul className="bet-warnings">
              {missingSelections > 0 && <li><AlertTriangle size={13} /> Faltan {missingSelections} {missingSelections === 1 ? 'selección' : 'selecciones'}: subí la parte que falta del ticket.</li>}
              {!totalOdds && complete.length > 0 && <li><AlertTriangle size={13} /> No vimos la cuota total. Podés cargarla en “Corregir”.</li>}
              {incomplete > 0 && <li><AlertTriangle size={13} /> {incomplete} {incomplete === 1 ? 'selección no tiene' : 'selecciones no tienen'} jugador o equipo.</li>}
            </ul>}
            <SelectionGroups groups={previewGroups} totalOdds={totalOdds.replace(',', '.')} />
          </div>}
          {!captured && !complete.length && <div className="bet-notice">{preview.originalUrl?.startsWith('https://') ? 'El enlace ya quedó guardado. Sumá capturas para que se vea el detalle, o publicalo así.' : 'Subí entre 1 y 5 capturas: leemos partido, horario, selecciones y cuotas.'}</div>}

          <button type="button" className="bet-button bet-button-quiet bet-edit-details" onClick={() => setEditing(!editing)}><Pencil size={15} /> {editing ? 'Listo, ocultar edición' : complete.length ? 'Corregir datos' : 'Cargar a mano'}</button>
          {editing && <div className="bet-edit-fields">
            <label className="bet-field">Cuota total del ticket<input inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="Ej.: 27,08" value={totalOdds} onChange={(event) => setTotalOdds(event.target.value)} /></label>
            {selections.map((row, index) => <div className="bet-manual-selection" key={index}>
              <div className="bet-section-title"><strong>Selección {index + 1}</strong><button type="button" className="bet-icon-button" aria-label={`Quitar selección ${index + 1}`} onClick={() => setSelections((old) => old.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>
              <div className="bet-field-grid"><label className="bet-field">Partido<input maxLength={200} placeholder="Warriors - Lakers" value={row.event} onChange={(event) => updateSelection(index, 'event', event.target.value)} /></label><label className="bet-field">Día y hora<input maxLength={40} placeholder="Hoy 21:30" value={row.startsAt} onChange={(event) => updateSelection(index, 'startsAt', event.target.value)} /></label></div>
              <div className="bet-field-grid"><label className="bet-field">Jugador<input maxLength={100} placeholder="Stephen Curry" value={row.player} onChange={(event) => updateSelection(index, 'player', event.target.value)} /></label><label className="bet-field">Equipo<input maxLength={100} placeholder="Warriors" value={row.team} onChange={(event) => updateSelection(index, 'team', event.target.value)} /></label></div>
              <div className="bet-field-grid"><label className="bet-field">Qué pusiste<input maxLength={200} placeholder="Más de 4,5 triples" value={row.pick} onChange={(event) => updateSelection(index, 'pick', event.target.value)} /></label><label className="bet-field">Cuota<input inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="1,85" value={row.odds} onChange={(event) => updateSelection(index, 'odds', event.target.value)} /></label></div>
            </div>)}
            <button type="button" className="bet-button bet-button-quiet" disabled={selections.length >= 40} onClick={() => setSelections((old) => [...old, { ...blank(), event: old.at(-1)?.event || '', startsAt: old.at(-1)?.startsAt || '' }])}><Plus size={15} /> Agregar selección</button>
          </div>}
        </>}
        <label className="bet-field">Tu comentario <span className="bet-muted">(opcional)</span><textarea rows={2} maxLength={2000} placeholder="¿Qué opinan? ¿Entra?" value={content} onChange={(event) => setContent(event.target.value)} disabled={busy} /></label>
      </>}
      {error && <p role="alert" className="bet-error">{error}</p>}
      <div className="bet-composer-footer">
        <span>{groupId ? `Solo la ve ${groups.find((group) => String(group.id) === groupId)?.name || 'el grupo'}.` : 'Visible para todos en el inicio.'}</span>
        <div className="bet-actions">
          {preview && <button type="button" className="bet-button bet-button-quiet" disabled={busy} onClick={restart}><ArrowLeft size={15} /> Volver</button>}
          <button className="bet-button" disabled={busy || (!!preview && !canPublish)}>{busy && !reading ? <Loader2 size={16} className="animate-spin" /> : preview ? <Send size={16} /> : <ArrowRight size={16} />}{busy && !reading ? 'Procesando…' : preview ? 'Publicar apuesta' : 'Continuar'}</button>
        </div>
      </div>
    </form>
  </section>;
}
