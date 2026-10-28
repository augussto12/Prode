import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BadRequestError } from '../utils/errors.js';

const run = promisify(execFile);
const validOdds = (value) => /^\d{1,12}(?:[.,]\d{1,12})?$/.test(value || '') && Number(value.replace(',', '.')) >= 1 && Number(value.replace(',', '.')) <= 1000000;
const decimal = (value) => value?.replace(',', '.') || null;
const market = /\b(?:m[aá]s|menos|sobre|bajo|over|under|ganador|gana|handicap|triple|triples|puntos|rebotes|asistencias|goles|tiros)\b/i;
const stakeMarket = /^(?:sobre|bajo|m[aá]s de|menos de|over|under)\s+\d+(?:[.,]\d+)?\s+(?:puntos?|rebotes?|asistencias?|triples?(?:\s+realizados?)?|goles?|tiros?)(?:\s+.*)?$/i;
const eventLine = (line) => /\b(?:vs\.?|versus|contra)\b|\s+@\s+|\s+[-–—]\s+(?=[\p{L}])/iu.test(line) && !market.test(line);
// Kick-off as the bookmaker shows it ("Hoy 21:30", "29/10 20:00"); kept as text
// because screenshots rarely carry the year or the timezone.
const startTime = /^(?:en vivo\s*)?(?:(?:hoy|esta noche|ma[nñ]ana|lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\p{L}*\.?,?\s*)?(?:\d{1,2}(?:[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\p{L}*\.?)?,?\s*)?(?:a las\s*)?\d{1,2}:\d{2}(?:\s*(?:hs?|[ap]\.?\s?m\.?))?$/iu;
// A bare "5:42" is as likely a live game clock as a kick-off, so it needs a day.
const timeLine = (line) => startTime.test(line || '') && !/^\d{1,2}:\d{2}$/.test(line) ? line.slice(0, 40) : null;
const noise = /^(?:stake|apuesta|pago|en vivo|\d{1,2}[':]|\d+[.,]?\d*|cuota|multi apuesta|deportes|casino|explorar|tal[oó]n|chat)\b/i;

function playerLine(line) {
  return !!line && !noise.test(line) && !market.test(line) && !eventLine(line) && !/[\d$@/:]/.test(line)
    && /^[\p{L}][\p{L}.'’ -]{2,99}$/u.test(line) && line.split(/\s+/).length <= 5;
}

function parseStake(rawText) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let event = '';
  let startsAt = null;
  let expectedSelections = null;
  let groupOdds = null;
  let explicitTotalOdds = null;
  const selections = [];
  const nextOdds = (index) => {
    const line = lines[index] || '';
    const labeled = line.match(/(?:cuota|odds?)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
    if (labeled && validOdds(labeled[1])) return decimal(labeled[1]);
    const bare = line.match(/^(\d{1,6}(?:[.,]\d{1,4})?)\s*[xX]?$/);
    return bare && validOdds(bare[1]) ? decimal(bare[1]) : null;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const stakeHeader = line.match(/multi\s+apuesta\s+del\s+mismo\s+partido\s*\(?\s*(\d{1,2})\s*\)?\s*(\d{1,6}[.,]\d{1,4})/i);
    if (stakeHeader) {
      expectedSelections = Number(stakeHeader[1]);
      if (validOdds(stakeHeader[2])) groupOdds = decimal(stakeHeader[2]);
      continue;
    }
    if (/(?:cuota|odds?)\s*(?:total|combinada|final)|(?:total|combined)\s*(?:cuota|odds?)/i.test(line)) {
      const inline = line.match(/(\d{1,6}(?:[.,]\d{1,4})?)(?!.*\d)/);
      explicitTotalOdds = inline && validOdds(inline[1]) ? decimal(inline[1]) : nextOdds(index + 1) || explicitTotalOdds;
      continue;
    }
    if (eventLine(line) && line.length <= 200) {
      event = line;
      startsAt = timeLine(lines[index - 1]) || timeLine(lines[index + 1]) || null;
      continue;
    }
    if (timeLine(line) || /^\d{1,2}:\d{2}$/.test(line)) continue;
    // Stake shows the market, then the player, then a live-progress bar. The
    // bar values are counts toward the market, never individual odds.
    if (stakeMarket.test(line)) {
      const playerIsNext = playerLine(lines[index + 1]);
      const player = playerIsNext ? lines[index + 1].slice(0, 100) : playerLine(lines[index - 1]) ? lines[index - 1].slice(0, 100) : null;
      selections.push({ event, startsAt, team: null, player, pick: line.slice(0, 200), odds: playerIsNext ? null : nextOdds(index + 1), groupOdds });
      continue;
    }
    if (!event || !market.test(line)) continue;
    const parts = line.split(/\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);
    const odds = nextOdds(index) || nextOdds(index + 1);
    const pick = (parts.length >= 2 ? parts[1] : line).replace(/(?:cuota|odds?)\s*[:\-]?\s*\d+(?:[.,]\d+)?/i, '').trim();
    if (!pick) continue;
    const previous = lines[index - 1] || '';
    const player = parts.length >= 2 && !market.test(parts[0]) ? parts[0] : playerLine(previous) ? previous : null;
    selections.push({ event, startsAt, team: null, player: player?.slice(0, 100) || null, pick: pick.slice(0, 200), odds, groupOdds });
  }
  const groupOddsValues = [...new Set(selections.map((selection) => selection.groupOdds).filter(Boolean))];
  return { totalOdds: explicitTotalOdds, explicitTotalOdds, expectedSelections, selections, headerOdds: groupOddsValues.length === 1 ? groupOddsValues[0] : null };
}

const teamName = /\b(?:Warriors|Nuggets|Mavericks|Heat|Bulls|Celtics|Thunder|Suns|Bucks|Pacers|Jazz|Grizzlies|Rockets|Hawks|Lakers|Clippers|Knicks|Nets|Spurs|Kings|Raptors|Pelicans|Pistons|Hornets|Magic|Trail Blazers|Timberwolves|Cavaliers|76ers|Wizards)\b/i;
const teamLine = (line) => teamName.test(line) && !/\b(?:puntos|rebotes|asistencias|total de|marcador|bet builder)\b/i.test(line);
// Bet365 prints the kick-off beside the teams: "DET Pistons  Mar 27 oct" / "NY Knicks  21:10".
const dayDate = /\b(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\.?\s+\d{1,2}\s+\p{L}{3}\.?/iu;
const trailingDayDate = /\s+(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\.?\s+\d{1,2}\s+\p{L}{3}.*$/iu;
const cleanTeam = (line) => line.replace(/^[^\p{L}]+/u, '').replace(trailingDayDate, '').replace(/\s+(?:\d{1,3}|\d{1,2}:\d{2}).*$/, '').trim();
function teamsStartTime(lines) {
  const teams = lines.filter(teamLine);
  const date = teams.map((line) => line.match(dayDate)?.[0]).find(Boolean);
  const time = teams.map((line) => line.match(/\b\d{1,2}:\d{2}\b/)?.[0]).find(Boolean);
  return date || time ? [date, time].filter(Boolean).join(' ') : null;
}
// Stake amount and potential payout, on the same line as their labels or below them.
function payoutOdds(lines) {
  const amount = /\$\s*([\d.]+,\d{2})/g;
  let stake = null; let payout = null;
  for (const [index, line] of lines.entries()) {
    const here = [...line.matchAll(amount)].map((match) => match[1]);
    const below = [...(lines[index + 1] || '').matchAll(amount)].map((match) => match[1]);
    if (/\bApuesta\b/i.test(line) && /\bGanancias\s+potenciales\b/i.test(line) && below.length >= 2) [stake, payout] = below;
    else if (/^Apuesta\b/i.test(line) && !stake) stake = here[0] || below[0] || null;
    else if (/\bGanancias\s+potenciales\b/i.test(line) && !payout) payout = here[0] || below[0] || null;
  }
  const money = (value) => Number(value.replaceAll('.', '').replace(',', '.'));
  const odds = stake && payout && money(stake) > 0 ? (money(payout) / money(stake)).toFixed(2) : null;
  return odds && validOdds(odds) ? odds : null;
}
const inlinePick = (line) => line.match(/^(.{3,100}?)\s*[-–—:]\s*(\d+(?:[.,]\d+)?\+\s*(?:puntos?|rebotes?|asistencias?|triples?))\b(?:\s+(\d+[.,]\d{2}))?/i);

function parseOther(rawText, provider) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = provider === 'bet365' ? /\bCREAR\s+APUESTA\b(?:.*?\b(\d+[.,]\d{2})\b)?/i : /\b(?:Bet\s*Builder|Creador\s+de\s+Apuestas)\b(?:.*?\b(\d+[.,]\d{2})\b)?/i;
  const blocks = [];
  let current = { lines: [], groupOdds: null };
  for (const [index, line] of lines.entries()) {
    const match = line.match(header);
    if (match) {
      if (current.lines.length) blocks.push(current);
      // Betano prints the builder odds in a badge, which OCR often puts on the next line.
      const odds = match[1] || lines[index + 1]?.match(/^(\d+[.,]\d{2})$/)?.[1];
      current = { lines: [], groupOdds: validOdds(odds) ? decimal(odds) : null };
    } else if (!(/^\d+[.,]\d{2}$/.test(line) && lines[index - 1]?.match(header) && !lines[index - 1].match(header)[1])) current.lines.push(line);
  }
  if (current.lines.length) blocks.push(current);
  const selections = [];
  for (const block of blocks) {
    const teams = block.lines.filter(teamLine).map(cleanTeam).filter(Boolean);
    const event = teams.length >= 2 ? `${teams[0]} - ${teams[1]}`.slice(0, 200) : '';
    const startsAt = block.lines.map(timeLine).find(Boolean) || teamsStartTime(block.lines);
    for (let index = 0; index < block.lines.length; index++) {
      const line = block.lines[index];
      if (provider === 'bet365') {
        const match = inlinePick(line);
        if (!match) continue;
        const player = match[1].replace(/^[^\p{L}]+/u, '').trim();
        if (!playerLine(player)) continue;
        const followingTeams = [];
        if (!block.groupOdds) for (let offset = index + 1; offset < block.lines.length && followingTeams.length < 2; offset++) {
          if (inlinePick(block.lines[offset])) break;
          if (teamLine(block.lines[offset])) followingTeams.push(cleanTeam(block.lines[offset]));
        }
        const rowEvent = followingTeams.length === 2 ? `${followingTeams[0]} - ${followingTeams[1]}` : event;
        selections.push({ event: rowEvent, startsAt: followingTeams.length === 2 ? teamsStartTime(block.lines.slice(index + 1)) || startsAt : startsAt, team: null, player, pick: match[2].trim(), odds: match[3] ? decimal(match[3]) : null, groupOdds: block.groupOdds });
      } else {
        const combined = /^((?:\d+(?:[.,]\d+)?\+)\s*)?(.+?)\s+Total\s+de\s+(Puntos|rebotes|asistencias|triples)/i.exec(line);
        if (!combined) continue;
        const previous = block.lines[index - 1] || '';
        const lineValue = combined[1]?.trim() || (/^\d+(?:[.,]\d+)?\+$/.test(previous) ? previous : null);
        const player = combined[2].trim();
        if (!lineValue || !playerLine(player)) continue;
        selections.push({ event, startsAt, team: null, player, pick: `${lineValue} ${combined[3]}`, odds: null, groupOdds: block.groupOdds });
      }
    }
  }
  const groupOdds = [...new Set(blocks.map((block) => block.groupOdds).filter(Boolean))];
  const headerTotal = groupOdds.length === 1 && blocks.filter((block) => block.groupOdds).length === 1 ? groupOdds[0] : null;
  const derivedTotalOdds = payoutOdds(lines);
  return { selections, expectedSelections: null, totalOdds: headerTotal || derivedTotalOdds, derivedTotalOdds,
    headerOdds: groupOdds.length === 1 ? groupOdds[0] : null };
}

// Betano splits each pick over several lines: "10+", "Victor Wembanyama Total de",
// "rebotes". Builder odds sit in a badge that OCR may place before or after the
// "Creador de Apuestas" title, and the ticket total follows "Doble"/"Triple"/...
const betanoMarket = /^(.+?)\s+((?:Total\s+de\s+.+)|(?:(?:Asistencias|Rebotes|Puntos|Triples|Tiros)\b.*\btotales))$/i;
const betanoComplete = (text) => !/(?:\by|\bde|,)$/i.test(text) && (/\btotales$/i.test(text) || /\bTotal\s+de\s+\p{L}{4,}/iu.test(text));
function parseBetano(rawText) {
  // OCR often reads the small bold "5+" as "St" or "S+".
  const lines = rawText.split(/\r?\n/).map((line) => line.trim().replace(/^S[t+]$/, '5+').replace(/^(\d{1,2})t$/, '$1+'))
    .filter((line) => line.length > 2 || /^\d{1,2}\+$/.test(line));
  const header = /\b(?:Bet\s*Builder|Creador\s+de\s+Apuestas)\b(?:.*?\b(\d+[.,]\d{2})\b)?/i;
  const bareOdds = /^(\d+[.,]\d{2})$/;
  const blocks = [];
  let block = null; let pick = null; let pendingOdds = null; let explicitTotalOdds = null; let typeSeen = false; let skipOdds = false;
  const closePick = () => {
    if (pick && block) {
      const text = pick.text.join(' ').replace(/\s+/g, ' ').trim();
      const inline = text.match(/^(\d+(?:[.,]\d+)?\+)\s*(.+)$/);
      const value = pick.value || inline?.[1] || null;
      const parts = betanoMarket.exec(inline && !pick.value ? inline[2] : text);
      if (parts && playerLine(parts[1].trim())) block.picks.push({ player: parts[1].trim().slice(0, 100), pick: [value, parts[2]].filter(Boolean).join(' ').slice(0, 200) });
    }
    pick = null;
  };
  for (const [index, line] of lines.entries()) {
    if (/^(?:Apuesta|Ganancias|Cash\s*out)\b/i.test(line)) { closePick(); break; }
    if (/^(?:Simple|Doble|Triple|Combinada|M[uú]ltiple)\b/i.test(line)) {
      typeSeen = true;
      const inline = line.match(/\s(\d+[.,]\d{2})$/)?.[1];
      if (inline && !/\$\s*[\d.]*$/.test(line.slice(0, -inline.length))) explicitTotalOdds = decimal(inline);
      continue;
    }
    const headerMatch = line.match(header);
    if (headerMatch) {
      closePick();
      const after = lines[index + 1]?.match(bareOdds)?.[1];
      const odds = headerMatch[1] || pendingOdds || after;
      skipOdds = !headerMatch[1] && !pendingOdds && !!after;
      block = { groupOdds: validOdds(odds) ? decimal(odds) : null, teams: [], startsAt: null, picks: [] };
      blocks.push(block); pendingOdds = null;
      continue;
    }
    if (bareOdds.test(line)) {
      if (skipOdds) { skipOdds = false; continue; }
      if (typeSeen && !explicitTotalOdds && !blocks.length) explicitTotalOdds = decimal(line);
      else pendingOdds = line;
      continue;
    }
    skipOdds = false;
    if (!block) continue;
    const time = timeLine(line) || (/^noche\s+\d{1,2}:\d{2}$/i.test(line) ? 'Esta ' + line : null);
    if (time) { block.startsAt ||= time; continue; }
    if (teamLine(line) && (!pick?.text.length || betanoComplete(pick.text.join(' ')))) { closePick(); block.teams.push(cleanTeam(line)); continue; }
    if (/^\d+(?:[.,]\d+)?\+$/.test(line)) { closePick(); pick = { value: line, text: [] }; continue; }
    const startsNew = /^\d+(?:[.,]\d+)?\+\s/.test(line) || (/^\p{Lu}/u.test(line) && pick && betanoComplete(pick.text.join(' ')));
    if (startsNew || !pick) { closePick(); pick = { value: null, text: [line] }; }
    else pick.text.push(line);
  }
  closePick();
  const selections = blocks.flatMap((item) => item.picks.map((entry) => ({
    event: item.teams.length >= 2 ? item.teams[0] + ' - ' + item.teams[1] : '', startsAt: item.startsAt, team: null,
    player: entry.player, pick: entry.pick, odds: null, groupOdds: item.groupOdds,
  })));
  const derivedTotalOdds = payoutOdds(rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  return { selections, expectedSelections: null, explicitTotalOdds, totalOdds: explicitTotalOdds || derivedTotalOdds, derivedTotalOdds, headerOdds: null };
}

const normalize = (value) => value?.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\d]+/gu, '') || '';
// "Sobre 10.5 Puntos", "Más de 10,5 puntos" and "Over 10.5 Points" are the same
// market; overlapping screenshots often show it with different OCR noise.
function canonicalPick(pick) {
  const text = (pick || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\b(?:sobre|mas de|over)\b/g, 'over').replace(/\b(?:bajo|menos de|under)\b/g, 'under')
    .replace(/\b(?:puntos?|points?)\b/g, 'pts').replace(/\b(?:rebotes?|rebounds?)\b/g, 'reb')
    .replace(/\b(?:asistencias?|assists?)\b/g, 'ast').replace(/\btriples?(?:\s+realizados?)?\b|\bthrees?\b/g, '3pt')
    .replace(/\btotal de\b/g, '');
  return text.replace(/[^\p{L}\d.+]+/gu, '');
}
const selectionKey = (selection) => `${normalize(selection.player)}|${canonicalPick(selection.pick)}`;

// One row per market: the same player and pick seen in two screenshots is merged,
// filling whatever one capture missed (match, time, odds) from the other.
export function mergeSelections(list) {
  const result = [];
  for (const selection of list) {
    const key = selectionKey(selection);
    const existing = result.find((item) => selectionKey(item) === key
      && (!item.event || !selection.event || normalize(item.event) === normalize(selection.event)));
    if (!existing) { result.push({ ...selection }); continue; }
    for (const field of ['event', 'startsAt', 'team', 'player', 'odds', 'groupOdds']) if (!existing[field] && selection[field]) existing[field] = selection[field];
  }
  return result;
}

// Recognizes the bookmaker from the text of a screenshot when the user did not say.
export function detectProviderFromText(text) {
  if (/\bbet\s*365\b|\bCREAR\s+APUESTA\b/i.test(text)) return 'bet365';
  if (/\bbetano\b|\bCreador\s+de\s+Apuestas\b|\bBet\s*Builder\b/i.test(text)) return 'betano';
  if (/\bstake\b|\bMulti\s+apuesta\s+del\s+mismo\s+partido\b/i.test(text)) return 'stake_pba';
  return null;
}

export function combineBetOcrTexts(rawTexts, provider = 'stake_pba') {
  const parts = rawTexts.filter(Boolean).map((text) => provider === 'stake_pba' ? parseStake(text) : provider === 'betano' ? parseBetano(text) : parseOther(text, provider));
  const events = [...new Set(parts.flatMap((part) => part.selections.map((selection) => selection.event).filter(Boolean)))];
  const soleEvent = events.length === 1 ? events[0] : null;
  const knownGroupOdds = [...new Set(parts.flatMap((part) => part.selections.map((selection) => selection.groupOdds).filter(Boolean)))];
  const knownSelections = new Map();
  for (const part of parts) for (const selection of part.selections) if (selection.event) {
    const key = selectionKey(selection);
    knownSelections.set(key, [...(knownSelections.get(key) || []), selection]);
  }
  const selections = mergeSelections(parts.flatMap((part) => part.selections).map((selection) => {
    const matchingEvents = [...new Set((knownSelections.get(selectionKey(selection)) || []).map((item) => item.event))];
    const matched = matchingEvents.length === 1 ? knownSelections.get(selectionKey(selection))[0] : null;
    return { ...selection, event: selection.event || matched?.event || soleEvent || '',
      groupOdds: selection.groupOdds || matched?.groupOdds || (knownGroupOdds.length === 1 ? knownGroupOdds[0] : null) };
  }));
  const headers = [...new Set(parts.map((part) => part.headerOdds).filter(Boolean))];
  const explicitTotalOdds = parts.find((part) => part.explicitTotalOdds)?.explicitTotalOdds;
  const derivedTotalOdds = parts.find((part) => part.derivedTotalOdds)?.derivedTotalOdds;
  const groupPairs = [...new Set(selections.filter((selection) => selection.groupOdds).map((selection) => `${selection.event}|${selection.groupOdds}`))];
  const oneGroupOdds = headers.length > 1 || groupPairs.length > 1 ? null : headers[0] || null;
  return { totalOdds: explicitTotalOdds || oneGroupOdds || derivedTotalOdds || null,
    expectedSelections: parts.find((part) => part.expectedSelections)?.expectedSelections || null,
    selections: selections.slice(0, 40) };
}

export function parseBetOcrText(rawText, provider = 'stake_pba') {
  return { ...combineBetOcrTexts([rawText], provider), rawText: rawText.slice(0, 10000) };
}

export function validateBetScreenshot(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new BadRequestError('Subí una captura JPG, PNG o WebP de hasta 5 MB.');
  }
  const signature = mimeType === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === 'image/jpeg' ? buffer?.[0] === 0xff && buffer?.[1] === 0xd8 && buffer?.[2] === 0xff
      : mimeType === 'image/webp' ? buffer?.toString('ascii', 0, 4) === 'RIFF' && buffer?.toString('ascii', 8, 12) === 'WEBP' : false;
  if (!signature) throw new BadRequestError('Subí una captura JPG, PNG o WebP de hasta 5 MB.');
}

// Tesseract is trained on dark text over light paper: bookmaker apps use light text
// on dark panels and small fonts. ImageMagick upscales, turns it grey, inverts dark
// screenshots and stretches contrast. Without ImageMagick the original image is used.
async function prepareForOcr(input, output) {
  try {
    const { stdout } = await run('convert', [input, '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:'], { timeout: 10000 });
    const dark = Number(stdout) < 0.5;
    await run('convert', [input, '-colorspace', 'Gray', '-resize', '200%', ...(dark ? ['-negate'] : []), '-normalize', '-sharpen', '0x1', output], { timeout: 20000 });
    return output;
  } catch { return input; }
}

export async function readBetScreenshot(buffer, mimeType, provider = 'stake_pba') {
  validateBetScreenshot(buffer, mimeType);
  const dir = await mkdtemp(join(tmpdir(), 'bet-ocr-'));
  const path = join(dir, `ticket.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`);
  try {
    await writeFile(path, buffer);
    const source = await prepareForOcr(path, join(dir, 'prepared.png'));
    // One layout-aware pass preserves the reading order of Stake's ticket.
    const ocr = (psm) => run('tesseract', [source, 'stdout', '-l', 'eng+spa', '--psm', psm], { timeout: 35000, maxBuffer: 64 * 1024 }).then((result) => result.stdout);
    const parser = provider === 'auto' ? (text) => parseBetOcrText(text, detectProviderFromText(text) || 'stake_pba') : (text) => parseBetOcrText(text, provider);
    const first = parser(await ocr('6'));
    // Sparse layout reads cards with wide gaps (Bet365, Betano) that block mode merges.
    if (first.selections.length) return first;
    const sparse = parser(await ocr('11'));
    return sparse.selections.length ? sparse : first;
  } catch {
    throw new BadRequestError('No se pudo leer la captura. Probá con una imagen más nítida.');
  } finally { await rm(dir, { recursive: true, force: true }); }
}

