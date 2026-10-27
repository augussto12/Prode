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

function parseOne(rawText) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let event = '';
  let totalOdds = null;
  let expectedSelections = null;
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
      if (validOdds(stakeHeader[2])) totalOdds = decimal(stakeHeader[2]);
      continue;
    }
    if (/(?:cuota|odds?)\s*(?:total|combinada|final)|(?:total|combined)\s*(?:cuota|odds?)/i.test(line)) {
      const inline = line.match(/(\d{1,6}(?:[.,]\d{1,4})?)(?!.*\d)/);
      totalOdds = inline && validOdds(inline[1]) ? decimal(inline[1]) : nextOdds(index + 1) || totalOdds;
      continue;
    }
    if (eventLine(line) && line.length <= 200) { event = line; continue; }
    // Stake shows the market, then the player, then a live-progress bar. The
    // bar values are counts toward the market, never individual odds.
    if (stakeMarket.test(line)) {
      const playerIsNext = playerLine(lines[index + 1]);
      const player = playerIsNext ? lines[index + 1].slice(0, 100) : playerLine(lines[index - 1]) ? lines[index - 1].slice(0, 100) : null;
      selections.push({ event, team: null, player, pick: line.slice(0, 200), odds: playerIsNext ? null : nextOdds(index + 1) });
      continue;
    }
    if (!event || !market.test(line)) continue;
    const parts = line.split(/\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);
    const odds = nextOdds(index) || nextOdds(index + 1);
    const pick = (parts.length >= 2 ? parts[1] : line).replace(/(?:cuota|odds?)\s*[:\-]?\s*\d+(?:[.,]\d+)?/i, '').trim();
    if (!pick) continue;
    const previous = lines[index - 1] || '';
    const player = parts.length >= 2 && !market.test(parts[0]) ? parts[0] : playerLine(previous) ? previous : null;
    selections.push({ event, team: null, player: player?.slice(0, 100) || null, pick: pick.slice(0, 200), odds });
  }
  return { totalOdds, expectedSelections, selections };
}

export function combineBetOcrTexts(rawTexts) {
  const parts = rawTexts.filter(Boolean).map(parseOne);
  const events = [...new Set(parts.flatMap((part) => part.selections.map((selection) => selection.event).filter(Boolean)))];
  const soleEvent = events.length === 1 ? events[0] : null;
  const selections = [];
  const seen = new Set();
  for (const part of parts) for (const selection of part.selections) {
    const row = { ...selection, event: selection.event || soleEvent || '' };
    const key = [row.event, row.player, row.pick].map((value) => value?.toLocaleLowerCase('es').replace(/[^\p{L}\d]+/gu, '') || '').join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    selections.push(row);
  }
  return { totalOdds: parts.find((part) => part.totalOdds)?.totalOdds || null,
    expectedSelections: parts.find((part) => part.expectedSelections)?.expectedSelections || null,
    selections: selections.slice(0, 40) };
}

export function parseBetOcrText(rawText) {
  return { ...combineBetOcrTexts([rawText]), rawText: rawText.slice(0, 10000) };
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

export async function readBetScreenshot(buffer, mimeType) {
  validateBetScreenshot(buffer, mimeType);
  const dir = await mkdtemp(join(tmpdir(), 'bet-ocr-'));
  const path = join(dir, `ticket.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`);
  try {
    await writeFile(path, buffer);
    // One layout-aware pass preserves the reading order of Stake's ticket.
    const { stdout } = await run('tesseract', [path, 'stdout', '-l', 'eng+spa', '--psm', '6'], { timeout: 35000, maxBuffer: 64 * 1024 });
    return parseBetOcrText(stdout);
  } catch {
    throw new BadRequestError('No se pudo leer la captura. Probá con una imagen más nítida.');
  } finally { await rm(dir, { recursive: true, force: true }); }
}
