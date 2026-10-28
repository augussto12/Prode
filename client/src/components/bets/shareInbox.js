export const SHARE_CACHE = 'prode-share-inbox-v1';

export function sharedBetUrl(value) {
  const match = String(value || '').match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return '';
  return match[0].replace(/[),.;]+$/, '');
}

export function providerForUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host === 'pba.stake.bet.ar') return 'stake_pba';
    const is = (domains) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (is(['bet365.com', 'bet365.bet.ar'])) return 'bet365';
    if (is(['betano.com', 'betano.bet.ar', 'betano.com.ar'])) return 'betano';
  } catch { /* The backend provides the final URL validation. */ }
  return null;
}

export async function readShareInbox() {
  if (!('caches' in window)) return null;
  const cache = await caches.open(SHARE_CACHE);
  const response = await cache.match('/__prode_share__/meta');
  if (!response) return null;
  const meta = await response.json();
  if (!meta.receivedAt || Date.now() - meta.receivedAt > 24 * 60 * 60 * 1000) {
    await caches.delete(SHARE_CACHE);
    return null;
  }
  const files = [];
  for (let index = 0; index < meta.files.length; index += 1) {
    const image = await cache.match(`/__prode_share__/image/${index}`);
    if (!image) throw new Error('Falta una captura compartida. Volvé a compartir el ticket.');
    files.push(new File([await image.blob()], meta.files[index].name || `captura-${index + 1}.jpg`, { type: meta.files[index].type }));
  }
  return { ...meta, files };
}
