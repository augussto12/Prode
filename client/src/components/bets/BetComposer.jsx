import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Link2, Loader2, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import TicketDetail from './TicketDetail';
import BetCaptureGallery from './BetCaptureGallery';
import { providerForUrl, sharedBetUrl } from './shareInbox';

const blank = () => ({ event: '', team: '', player: '', pick: '', odds: '' });
const showOdds = (value) => value ? String(value).replace('.', ',') : '—';
const providers = { stake_pba: 'Stake PBA', bet365: 'Bet365', betano: 'Betano' };

export default function BetComposer({ groups, fixedGroupId, initialShare, onPublished, onClose }) {
  const [groupId, setGroupId] = useState(String(fixedGroupId || ''));
  const initialUrl = sharedBetUrl(initialShare?.url) || sharedBetUrl(initialShare?.text) || sharedBetUrl(initialShare?.title);
  const [url, setUrl] = useState(initialUrl);
  const [provider, setProvider] = useState(providerForUrl(initialUrl) || 'stake_pba');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(null);
  const [totalOdds, setTotalOdds] = useState('');
  const [expectedSelections, setExpectedSelections] = useState(null);
  const [selections, setSelections] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const imageUrls = useRef([]);
  useEffect(() => () => imageUrls.current.forEach((value) => URL.revokeObjectURL(value)), []);
  const chosenGroup = groupId ? Number(groupId) : undefined;
  const captured = captures.length > 0;
  const previewGroups = selections.filter((row) => row.event && row.pick).reduce((result, row) => {
    const key = `${row.event}|${row.groupOdds || ''}`;
    let group = result.find((item) => item.key === key);
    if (!group) { group = { key, event: row.event, odds: row.groupOdds, selections: [] }; result.push(group); }
    group.selections.push(row);
    return result;
  }, []);

  async function read(event) {
    event.preventDefault();
    await makePreview(provider, url);
  }

  async function makePreview(selectedProvider, selectedUrl) {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/community/imports', { provider: selectedProvider, ...(selectedUrl.trim() ? { sharedUrl: selectedUrl.trim() } : {}), ...(chosenGroup ? { groupId: chosenGroup } : {}) }, { timeout: 25000 });
      setPreview(data);
      if (initialShare?.files?.length && !data.ticket) await scanFiles(initialShare.files, data.id);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  async function scanFiles(files, draftId) {
    if (!files.length) return;
    if (files.length + captures.length > 3) { setError('Podés subir hasta 3 capturas por ticket.'); return; }
    setBusy(true); setError('');
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Cada captura debe ser JPG, PNG o WebP de hasta 5 MB.');
        const { data } = await api.post('/community/scan', file, { params: { draftId }, headers: { 'Content-Type': file.type }, timeout: 45000 });
        const imageUrl = URL.createObjectURL(file);
        imageUrls.current.push(imageUrl);
        setCaptures((old) => [...old, { id: data.id, src: imageUrl }]);
        setTotalOdds(data.totalOdds || '');
        setExpectedSelections(data.expectedSelections || null);
        setSelections((data.selections || []).map((item) => ({ ...blank(), ...item, team: item.team || '', player: item.player || '', odds: item.odds || '', groupOdds: item.groupOdds || null })));
        if (data.ocrFailed) setError('La captura se guardó, pero no pudimos leerla automáticamente. Probá con otra imagen más nítida.');
      }
    } catch (err) { setError(err.message && !err.response ? err.message : getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  async function scan(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await scanFiles(files, preview.id);
  }

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
        const complete = selections.filter((row) => row.event.trim() && row.pick.trim());
        if (complete.length) payload.selections = complete.map((row) => ({ event: row.event.trim(), team: row.team.trim() || null, player: row.player.trim() || null, pick: row.pick.trim(), odds: row.odds.trim() ? row.odds.trim().replace(',', '.') : null, groupOdds: row.groupOdds || null }));
      }
      const { data } = await api.post('/community/posts', payload);
      onPublished(data);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setBusy(false); }
  }

  function changeLink() {
    imageUrls.current.forEach((value) => URL.revokeObjectURL(value));
    imageUrls.current = [];
    setPreview(null); setCaptures([]); setSelections([]); setTotalOdds(''); setExpectedSelections(null); setEditing(false); setError('');
  }

  return <section className="bet-composer bet-panel" aria-label="Nueva apuesta compartida">
    <div className="bet-section-title"><div><span className="bet-eyebrow">COMPARTIR APUESTA</span><h2>Mostrá tu ticket.</h2></div><button type="button" className="bet-icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={19} /></button></div>
    <form onSubmit={preview ? publish : read}>
      <label className="bet-field">¿Quién puede verla?<select value={groupId} disabled={busy || !!fixedGroupId || !!preview} onChange={(event) => setGroupId(event.target.value)}><option value="">Todos, en el inicio</option>{groups.map((group) => <option key={group.id} value={group.id}>Solo {group.name}</option>)}</select></label>
      {!preview ? <><label className="bet-field">Casa de apuestas<select value={provider} disabled={busy} onChange={(event) => { setProvider(event.target.value); setUrl(''); }}>{Object.entries(providers).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className="bet-field">Enlace compartido <span className="bet-muted">(opcional)</span><div className="bet-url-input"><Link2 size={18} /><input type="url" maxLength={2048} placeholder="Pegá un enlace de la casa de apuestas" value={url} onChange={(event) => { setUrl(event.target.value); const detected = providerForUrl(event.target.value); if (detected) setProvider(detected); }} disabled={busy} /></div><small>Sirve para identificar el ticket y evitar duplicados. También podés seguir con capturas.</small></label><button type="button" className="bet-button bet-button-quiet" onClick={pasteLink} disabled={busy}>Pegar enlace copiado</button>{initialShare?.files?.length ? <p className="bet-notice">Recibimos {initialShare.files.length} {initialShare.files.length === 1 ? 'captura' : 'capturas'}. Al continuar se leerán automáticamente.</p> : <p className="bet-muted">En el siguiente paso subís las capturas de {providers[provider]}.</p>}</> : <>
        {preview.ticket ? <TicketDetail ticket={preview.ticket} originalUrl={preview.originalUrl} /> : <>
          <label className="bet-upload"><Camera size={20} /><span>{captured ? 'Agregar otra captura' : 'Subir capturas del ticket'}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={scan} disabled={busy || captures.length >= 3} /></label>
          <p className="bet-muted">Las capturas se guardan con la apuesta y se ven al publicarla. Revisá si muestran importes o datos personales.</p>
          {captured && <BetCaptureGallery images={captures} />}
          {(captured || selections.length > 0) && <div className="bet-ticket bet-read-preview"><div className="bet-ticket-top"><span className="bet-provider">{providers[provider].toUpperCase()}</span><span className="bet-label">Leído de capturas</span></div><div className="bet-ticket-summary"><div><span>{selections.length ? `${selections.length}${expectedSelections ? ` de ${expectedSelections}` : ''} selecciones reconocidas` : 'Detalle en las capturas'}</span><small>{[...new Set(selections.map((row) => row.event).filter(Boolean))].join(' · ') || 'Revisá la vista antes de publicar'}</small></div><div className="bet-odds"><small>Cuota total</small><strong>{showOdds(totalOdds)}</strong></div></div>{expectedSelections && selections.length < expectedSelections && <p className="bet-muted">Faltan selecciones en la lectura. Subí la parte restante del ticket.</p>}{previewGroups.map((group) => <section className="bet-selection-group" key={group.key}><div className="bet-selection-group-title"><strong>{group.event}</strong>{group.odds && (previewGroups.length > 1 || Number(group.odds) !== Number(totalOdds)) && <span>Cuota del partido {showOdds(group.odds)}</span>}</div>{group.selections.map((row, index) => <div className="bet-manual-row" key={`${group.key}-${index}`}><div><strong>{row.player || row.event}</strong><p>{row.pick}</p></div>{row.odds && <b>Cuota {showOdds(row.odds)}</b>}</div>)}</section>)}</div>}
          {!captured && !selections.length && <div className="bet-notice">{preview.originalUrl?.startsWith('https://') ? 'El enlace quedó asociado a este ticket. Subí capturas para mostrar el detalle, o publicá el enlace.' : 'Subí las capturas para ver tu ticket. También podés cargar los datos manualmente.'}</div>}
          <button type="button" className="bet-button bet-button-quiet bet-edit-details" onClick={() => setEditing(!editing)}><Pencil size={15} /> {editing ? 'Ocultar edición' : 'Corregir o agregar datos'}</button>
          {editing && <div className="bet-edit-fields"><label className="bet-field">Cuota total del ticket<input inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="Ej.: 27,08" value={totalOdds} onChange={(event) => setTotalOdds(event.target.value)} /></label><div className="bet-section-title"><h3>Selecciones</h3><button type="button" className="bet-button bet-button-quiet" disabled={selections.length >= 40} onClick={() => setSelections((old) => [...old, blank()])}><Plus size={15} /> Agregar selección</button></div>{selections.map((row, index) => <div className="bet-manual-selection" key={index}><div className="bet-section-title"><strong>Selección {index + 1}</strong><button type="button" className="bet-icon-button" aria-label={`Quitar selección ${index + 1}`} onClick={() => setSelections((old) => old.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div><label className="bet-field">Partido<input maxLength={200} placeholder="Warriors vs. Lakers" value={row.event} onChange={(event) => updateSelection(index, 'event', event.target.value)} /></label><div className="bet-field-grid"><label className="bet-field">Equipo<input maxLength={100} placeholder="Warriors" value={row.team} onChange={(event) => updateSelection(index, 'team', event.target.value)} /></label><label className="bet-field">Jugador<input maxLength={100} placeholder="Stephen Curry" value={row.player} onChange={(event) => updateSelection(index, 'player', event.target.value)} /></label></div><div className="bet-field-grid"><label className="bet-field">Qué pusiste<input maxLength={200} placeholder="Más de 4,5 triples" value={row.pick} onChange={(event) => updateSelection(index, 'pick', event.target.value)} /></label><label className="bet-field">Cuota individual<input inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="1,85" value={row.odds} onChange={(event) => updateSelection(index, 'odds', event.target.value)} /></label></div></div>)}</div>}
        </>}
        <label className="bet-field">Tu comentario <span className="bet-muted">(opcional)</span><textarea rows={3} maxLength={2000} placeholder="¿Qué opinan?" value={content} onChange={(event) => setContent(event.target.value)} disabled={busy} /></label>
      </>}
      {error && <p role="alert" className="bet-error">{error}</p>}
      <div className="bet-composer-footer"><span>{groupId ? 'Solo lo ven los integrantes del grupo.' : 'Esta apuesta será visible para todos en el inicio.'}</span><div className="bet-actions">{preview && <button type="button" className="bet-button bet-button-quiet" disabled={busy} onClick={changeLink}>Cambiar enlace</button>}<button className="bet-button" disabled={busy || (!!preview && !preview.ticket && !captured && !selections.some((row) => row.event && row.pick) && !preview.originalUrl?.startsWith('https://'))}>{busy ? <Loader2 size={16} className="animate-spin" /> : preview ? <Send size={16} /> : <ArrowRight size={16} />}{busy ? 'Procesando…' : preview ? 'Publicar apuesta' : 'Continuar'}</button></div></div>
    </form>
  </section>;
}
