import { Clock } from 'lucide-react';

export const showOdds = (value) => value ? String(value).replace('.', ',') : '—';

// Groups selections by match (and builder odds) the way bookmakers show them.
export function groupSelections(selections, groupOddsFor = (selection) => selection.groupOdds) {
  return selections.reduce((result, selection) => {
    const groupOdds = groupOddsFor(selection) || null;
    const key = `${selection.event}|${groupOdds || ''}`;
    let group = result.find((item) => item.key === key);
    if (!group) { group = { key, event: selection.event, startsAt: selection.startsAt, odds: groupOdds, selections: [] }; result.push(group); }
    group.startsAt ||= selection.startsAt;
    group.selections.push(selection);
    return result;
  }, []);
}

export default function SelectionGroups({ groups, totalOdds }) {
  return groups.map((group) => <section className="bet-selection-group" key={group.key}>
    <div className="bet-selection-group-title">
      <div><strong>{group.event || 'Partido no visible'}</strong>{group.startsAt && <small className="bet-start-time"><Clock size={11} /> {group.startsAt}</small>}</div>
      {group.odds && (groups.length > 1 || Number(group.odds) !== Number(totalOdds)) && <span>Cuota del partido {showOdds(group.odds)}</span>}
    </div>
    {group.selections.map((selection, index) => <div className="bet-manual-row" key={`${group.key}-${index}`}>
      <div><strong>{selection.player || selection.team || selection.event}</strong><p>{selection.pick}</p></div>
      {selection.odds && <b>Cuota {showOdds(selection.odds)}</b>}
    </div>)}
  </section>);
}
