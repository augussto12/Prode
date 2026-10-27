import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BadRequestError } from '../utils/errors.js';

const run = promisify(execFile);
const validOdds = (value) => /^\d{1,12}(?:[.,]\d{1,12})?$/.test(value || '') && Number(value.replace(',', '.')) >= 1;

export function parseBetOcrText(rawText) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let event = '';
  let totalOdds = null;
  const selections = [];
  for (const line of lines) {
    const total = line.match(/(?:cuota|odds?)\s*(?:total|combinada|final)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
    if (total && validOdds(total[1])) { totalOdds = total[1].replace(',', '.'); continue; }
    if (/\b(?:vs\.?|versus|contra)\b/i.test(line) && line.length <= 200) { event = line; continue; }
    if (!event || !/\b(?:m[aá]s|menos|over|under|ganador|gana|handicap|triple|triples|puntos|rebotes|asistencias)\b/i.test(line)) continue;
    const parts = line.split(/\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);
    const maybeOdds = line.match(/(?:cuota|odds?)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
    const pick = (parts.length >= 2 ? parts[1] : line).replace(/(?:cuota|odds?)\s*[:\-]?\s*\d+(?:[.,]\d+)?/i, '').trim();
    if (!pick) continue;
    selections.push({ event, team: null, player: parts.length >= 2 && !/\b(?:m[aá]s|menos|over|under)\b/i.test(parts[0]) ? parts[0].slice(0, 100) : null,
      pick: pick.slice(0, 200), odds: maybeOdds && validOdds(maybeOdds[1]) ? maybeOdds[1].replace(',', '.') : null });
  }
  return { totalOdds, selections: selections.slice(0, 40), rawText: rawText.slice(0, 3000) };
}

export async function readBetScreenshot(buffer, mimeType) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !buffer?.length || buffer.length > 5 * 1024 * 1024) {
    throw new BadRequestError('Subí una captura JPG, PNG o WebP de hasta 5 MB.');
  }
  const dir = await mkdtemp(join(tmpdir(), 'bet-ocr-'));
  const path = join(dir, `ticket.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`);
  try {
    await writeFile(path, buffer);
    const { stdout } = await run('tesseract', [path, 'stdout', '-l', 'eng+spa', '--psm', '6'], { timeout: 15000, maxBuffer: 64 * 1024 });
    return parseBetOcrText(stdout);
  } catch {
    throw new BadRequestError('No se pudo leer la captura. Revisá la imagen o cargá los datos a mano.');
  } finally { await rm(dir, { recursive: true, force: true }); }
}
