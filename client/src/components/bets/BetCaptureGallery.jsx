import { useEffect, useState } from 'react';
import { Images, Maximize2, X } from 'lucide-react';

export default function BetCaptureGallery({ images }) {
  const [open, setOpen] = useState(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open === null) return undefined;
    const close = (event) => { if (event.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  if (!images?.length) return null;
  return <section className="bet-captures" aria-label="Capturas del ticket">
    <button type="button" className="bet-captures-toggle" aria-expanded={visible} onClick={() => setVisible((value) => !value)}><Images size={16} /> {visible ? 'Ocultar capturas' : `Ver capturas (${images.length})`}</button>
    {visible && <div className="bet-captures-grid">{images.map((image, index) => <button type="button" key={image.id || index} onClick={() => setOpen(index)} aria-label={`Ampliar captura ${index + 1}`}><img src={image.src} alt={`Captura ${index + 1} del ticket`} loading="lazy" /><span><Maximize2 size={14} /> Ver captura {index + 1}</span></button>)}</div>}
    {open !== null && <div className="bet-capture-overlay" role="presentation" onClick={() => setOpen(null)}><div role="dialog" aria-modal="true" aria-label={`Captura ${open + 1} del ticket`} onClick={(event) => event.stopPropagation()}><button type="button" className="bet-capture-close" onClick={() => setOpen(null)} aria-label="Cerrar captura"><X size={20} /></button><img src={images[open].src} alt={`Captura ${open + 1} del ticket ampliada`} /></div></div>}
  </section>;
}
