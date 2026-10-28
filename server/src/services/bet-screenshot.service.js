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
const cleanTeam = (line) => line.replace(/^[^\p{L}]+/u, '').replace(/\s+(?:\d{1,3}|\d{1,2}:\d{2}).*$/, '').trim();
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
    const startsAt = block.lines.map(timeLine).find(Boolean) || null;
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
        selections.push({ event: rowEvent, startsAt, team: null, player, pick: match[2].trim(), odds: match[3] ? decimal(match[3]) : null, groupOdds: block.groupOdds });
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
  const stakeAmount = rawText.match(/\bApuesta\s*\$?\s*([\d.]+,\d{2})/i)?.[1];
  const payoutAmount = rawText.match(/\bGanancias\s+potenciales\s*\$?\s*([\d.]+,\d{2})/i)?.[1];
  const money = (value) => Number(value.replaceAll('.', '').replace(',', '.'));
  const payoutOdds = stakeAmount && payoutAmount && money(stakeAmount) > 0 ? (money(payoutAmount) / money(stakeAmount)).toFixed(2) : null;
  const headerTotal = groupOdds.length === 1 && blocks.filter((block) => block.groupOdds).length === 1 ? groupOdds[0] : null;
  const derivedTotalOdds = payoutOdds && validOdds(payoutOdds) ? payoutOdds : null;
  return { selections, expectedSelections: null, totalOdds: headerTotal || derivedTotalOdds, derivedTotalOdds,
    headerOdds: groupOdds.length === 1 ? groupOdds[0] : null };
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
  const parts = rawTexts.filter(Boolean).map((text) => provider === 'stake_pba' ? parseStake(text) : parseOther(text, provider));
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

