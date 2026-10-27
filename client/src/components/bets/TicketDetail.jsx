import { ExternalLink, Link2, CheckCircle2 } from 'lucide-react';

const marketNames = { points: 'Puntos', rebounds: 'Rebotes', assists: 'Asistencias', 'points+assists+rebounds': 'Puntos + asistencias + rebotes' };
const decimal = (value) => String(value).replace('.', ',');

export default function TicketDetail({ ticket, originalUrl }) {
  return <div className="bet-ticket">
    <div className="bet-ticket-top">
      <span className="bet-provider">STAKE PBA</span>
      <span className={`bet-label ${ticket ? 'bet-label-ready' : ''}`}>
        {ticket ? <><CheckCircle2 size={13} /> Detalle importado</> : <><Link2 size={13} /> Solo enlace</>}
      </span>
    </div>
    {ticket ? <>
      <div className="bet-ticket-summary"><div><span>{ticket.groupsCount} partidos · {ticket.selectionCount} selecciones</span><small>{ticket.betAcceptanceStatus === 'confirmed' ? 'Confirmada por la casa' : `Estado original: ${ticket.betAcceptanceStatus}`} · Resultado sin verificar</small></div><div className="bet-odds"><small>Cuota original</small><strong>{decimal(ticket.originalOdds)}</strong></div></div>
      <div className="bet-events">{ticket.groups.map((group) => <details key={group.eventId} open>
        <summary><span>{group.event}</span>{ticket.groups.length > 1 && <span className="bet-group-odds">{decimal(group.groupOdds)}</span>}</summary>
        {group.selections.map((selection) => <div className="bet-selection" key={selection.sourceIndex}>
          <span className="bet-selection-dot" /><div><strong>{selection.player}</strong><span>{marketNames[selection.market] || selection.market}</span></div>
          <b>{selection.direction === 'over' ? 'Más de' : 'Menos de'} {decimal(selection.line)}</b>
        </div>)}
      </details>)}</div>
    </> : <div className="bet-link-only"><Link2 size={26} /><div><strong>El ticket está en el enlace original</strong><p>No se importaron los mercados ni las cuotas. Podés ver la apuesta en Stake y conversar sobre ella acá.</p></div></div>}
    <a className="bet-external" href={originalUrl} target="_blank" rel="noopener noreferrer">Ver apuesta en Stake <ExternalLink size={14} /></a>
  </div>;
}
