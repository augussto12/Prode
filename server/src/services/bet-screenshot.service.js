import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BadRequestError } from '../utils/errors.js';

const run = promisify(execFile);
const validOdds = (value) => /^\d{1,12}(?:[.,]\d{1,12})?$/.test(value || '') && Number(value.replace(',', '.')) >= 1 && Number(value.replace(',', '.')) <= 1000000;

export function parseBetOcrText(rawText) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let event = '';
  let totalOdds = null;
  const selections = [];
  const market = /\b(?:m[aá]s|menos|over|under|ganador|gana|handicap|triple|triples|puntos|rebotes|asistencias|goles|tiros)\b/i;
  const eventLine = (line) => /\b(?:vs\.?|versus|contra)\b|\s+@\s+|\s+[-–—]\s+(?=[\p{L}])/iu.test(line) && !market.test(line);
  const nextOdds = (index) => {
    const line = lines[index] || '';
    const labeled = line.match(/(?:cuota|odds?)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
    if (labeled && validOdds(labeled[1])) return labeled[1].replace(',', '.');
    const bare = line.match(/^(\d{1,6}(?:[.,]\d{1,4})?)\s*[xX]?$/);
    return bare && validOdds(bare[1]) ? bare[1].replace(',', '.') : null;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/(?:cuota|odds?)\s*(?:total|combinada|final)|(?:total|combined)\s*(?:cuota|odds?)/i.test(line)) {
      const inline = line.match(/(\d{1,6}(?:[.,]\d{1,4})?)(?!.*\d)/);
      totalOdds = inline && validOdds(inline[1]) ? inline[1].replace(',', '.') : nextOdds(index + 1) || totalOdds;
      continue;
    }
    if (eventLine(line) && line.length <= 200) { event = line; continue; }
    if (!event || !market.test(line)) continue;
    const parts = line.split(/\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);
    const inlineOdds = nextOdds(index);
    const odds = inlineOdds || nextOdds(index + 1);
    const pick = (parts.length >= 2 ? parts[1] : line).replace(/(?:cuota|odds?)\s*[:\-]?\s*\d+(?:[.,]\d+)?/i, '').trim();
    if (!pick) continue;
    const previous = lines[index - 1] || '';
    const player = parts.length >= 2 && !market.test(parts[0]) ? parts[0]
      : previous && !eventLine(previous) && !market.test(previous) && !/\d|cuota|stake|ticket/i.test(previous) && previous.split(/\s+/).length <= 5 ? previous : null;
    selections.push({ event, team: null, player: player?.slice(0, 100) || null, pick: pick.slice(0, 200), odds });
  }
  return { totalOdds, selections: selections.slice(0, 40), rawText: rawText.slice(0, 3000) };
}

export function validateBetScreenshot(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new BadRequestError('Subí una captura JPG, PNG o WebP de hasta 5 MB.');
  }
  const signature = mimeType === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === 'image/jpeg' ? buffer?.[0] === 0xff && buffer?.[1] === 0xd8 && buffer?.[2] === 0xff
      : mimeType === 'image/webp' ? buffer?.toString('ascii', 0, 4) === 'RIFF' && buffer?.toString('ascii', 8, 12) === 'WEBP' : false;
  if (!signature) {
    throw new BadRequestError('Subí una captura JPG, PNG o WebP de hasta 5 MB.');
  }
}

export async function readBetScreenshot(buffer, mimeType) {
  validateBetScreenshot(buffer, mimeType);
  const dir = await mkdtemp(join(tmpdir(), 'bet-ocr-'));
  const path = join(dir, `ticket.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`);
  try {
    await writeFile(path, buffer);
    const results = await Promise.allSettled(['6', '11'].map((mode) => run('tesseract', [path, 'stdout', '-l', 'eng+spa', '--psm', mode], { timeout: 15000, maxBuffer: 64 * 1024 })));
    const parsed = results.filter((result) => result.status === 'fulfilled').map((result) => parseBetOcrText(result.value.stdout));
    if (!parsed.length) throw new Error('OCR failed');
    return parsed.sort((a, b) => (b.selections.length * 2 + Number(Boolean(b.totalOdds))) - (a.selections.length * 2 + Number(Boolean(a.totalOdds))))[0];
  } catch {
    throw new BadRequestError('No se pudo leer la captura. Revisá la imagen o cargá los datos a mano.');
  } finally { await rm(dir, { recursive: true, force: true }); }
}
