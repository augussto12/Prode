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
const noise = /^(?:stake|apuesta|pago|en vivo|\d{1,2}[':]|\d+[.,]?\d*|cuota|multi apuesta|deportes|casino|explorar|tal[oó]n|chat)\b/i;

function playerLine(line) {
  return !!line && !noise.test(line) && !market.test(line) && !eventLine(line) && !/[\d$@/:]/.test(line)
    && /^[\p{L}][\p{L}.'’ -]{2,99}$/u.test(line) && line.split(/\s+/).length <= 5;
}

function parseStake(rawText) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let event = '';
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
    if (eventLine(line) && line.length <= 200) { event = line; continue; }
    // Stake shows the market, then the player, then a live-progress bar. The
    // bar values are counts toward the market, never individual odds.
    if (stakeMarket.test(line)) {
      const playerIsNext = playerLine(lines[index + 1]);
      const player = playerIsNext ? lines[index + 1].slice(0, 100) : playerLine(lines[index - 1]) ? lines[index - 1].slice(0, 100) : null;
      selections.push({ event, team: null, player, pick: line.slice(0, 200), odds: playerIsNext ? null : nextOdds(index + 1), groupOdds });
      continue;
    }
    if (!event || !market.test(line)) continue;
    const parts = line.split(/\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);
    const odds = nextOdds(index) || nextOdds(index + 1);
    const pick = (parts.length >= 2 ? parts[1] : line).replace(/(?:cuota|odds?)\s*[:\-]?\s*\d+(?:[.,]\d+)?/i, '').trim();
    if (!pick) continue;
    const previous = lines[index - 1] || '';
    const player = parts.length >= 2 && !market.test(parts[0]) ? parts[0] : playerLine(previous) ? previous : null;
    selections.push({ event, team: null, player: player?.slice(0, 100) || null, pick: pick.slice(0, 200), odds, groupOdds });
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
  const header = provider === 'bet365' ? /\bCREAR\s+APUESTA\b.*?\b(\d+[.,]\d{2})\b/i : /\bBet\s*Builder\b.*?\b(\d+[.,]\d{2})\b/i;
  const blocks = [];
  let current = { lines: [], groupOdds: null };
  for (const line of lines) {
    const match = line.match(header);
    if (match) {
      if (current.lines.length) blocks.push(current);
      current = { lines: [], groupOdds: validOdds(match[1]) ? decimal(match[1]) : null };
    } else current.lines.push(line);
  }
  if (current.lines.length) blocks.push(current);
  const selections = [];
  for (const block of blocks) {
    const teams = block.lines.filter(teamLine).map(cleanTeam).filter(Boolean);
    const event = teams.length >= 2 ? `${teams[0]} - ${teams[1]}`.slice(0, 200) : '';
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
        selections.push({ event: rowEvent, team: null, player, pick: match[2].trim(), odds: match[3] ? decimal(match[3]) : null, groupOdds: block.groupOdds });
      } else {
        const combined = /^((?:\d+(?:[.,]\d+)?\+)\s*)?(.+?)\s+Total\s+de\s+(Puntos|rebotes|asistencias|triples)/i.exec(line);
        if (!combined) continue;
        const previous = block.lines[index - 1] || '';
        const lineValue = combined[1]?.trim() || (/^\d+(?:[.,]\d+)?\+$/.test(previous) ? previous : null);
        const player = combined[2].trim();
        if (!lineValue || !playerLine(player)) continue;
        selections.push({ event, team: null, player, pick: `${lineValue} ${combined[3]}`, odds: null, groupOdds: block.groupOdds });
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

export function combineBetOcrTexts(rawTexts, provider = 'stake_pba') {
  const parts = rawTexts.filter(Boolean).map((text) => provider === 'stake_pba' ? parseStake(text) : parseOther(text, provider));
  const events = [...new Set(parts.flatMap((part) => part.selections.map((selection) => selection.event).filter(Boolean)))];
  const soleEvent = events.length === 1 ? events[0] : null;
  const knownGroupOdds = [...new Set(parts.flatMap((part) => part.selections.map((selection) => selection.groupOdds).filter(Boolean)))];
  const normalize = (value) => value?.toLocaleLowerCase('es').replace(/[^\p{L}\d]+/gu, '') || '';
  const knownSelections = new Map();
  for (const part of parts) for (const selection of part.selections) if (selection.event) {
    const key = `${normalize(selection.player)}|${normalize(selection.pick)}`;
    const matches = knownSelections.get(key) || [];
    matches.push(selection);
    knownSelections.set(key, matches);
  }
  const selections = [];
  const seen = new Set();
  for (const part of parts) for (const selection of part.selections) {
    const matching = knownSelections.get(`${normalize(selection.player)}|${normalize(selection.pick)}`) || [];
    const matchingEvents = [...new Set(matching.map((item) => item.event))];
    const matched = matchingEvents.length === 1 ? matching[0] : null;
    const row = { ...selection, event: selection.event || matched?.event || soleEvent || '',
      groupOdds: selection.groupOdds || matched?.groupOdds || (knownGroupOdds.length === 1 ? knownGroupOdds[0] : null) };
    const key = [row.event, row.player, row.pick].map(normalize).join('|');
    if (seen.has(key)) {
      const existing = selections.find((item) => [item.event, item.player, item.pick].map(normalize).join('|') === key);
      if (existing && !existing.groupOdds) existing.groupOdds = row.groupOdds;
      continue;
    }
    seen.add(key);
    selections.push(row);
  }
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

export async function readBetScreenshot(buffer, mimeType, provider = 'stake_pba') {
  validateBetScreenshot(buffer, mimeType);
  const dir = await mkdtemp(join(tmpdir(), 'bet-ocr-'));
  const path = join(dir, `ticket.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`);
  try {
    await writeFile(path, buffer);
    // One layout-aware pass preserves the reading order of Stake's ticket.
    const { stdout } = await run('tesseract', [path, 'stdout', '-l', 'eng+spa', '--psm', '6'], { timeout: 35000, maxBuffer: 64 * 1024 });
    return parseBetOcrText(stdout, provider);
  } catch {
    throw new BadRequestError('No se pudo leer la captura. Probá con una imagen más nítida.');
  } finally { await rm(dir, { recursive: true, force: true }); }
}
