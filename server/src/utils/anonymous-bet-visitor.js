import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const ANONYMOUS_BET_COOKIE = 'prode_anonymous_bet_visitor';

export function anonymousBetVisitor(cookieValue, secret) {
  let id;
  const [candidate, suppliedSignature, extra] = String(cookieValue || '').split('.');
  if (!extra && /^[0-9a-f-]{36}$/.test(candidate || '') && /^[0-9a-f]{64}$/.test(suppliedSignature || '')) {
    const expected = createHmac('sha256', secret).update(candidate).digest('hex');
    if (timingSafeEqual(Buffer.from(suppliedSignature, 'hex'), Buffer.from(expected, 'hex'))) id = candidate;
  }
  const fresh = !id;
  if (fresh) id = randomUUID();
  const signature = createHmac('sha256', secret).update(id).digest('hex');
  return {
    cookie: `${id}.${signature}`,
    visitorKey: createHash('sha256').update(id).digest('hex'),
    fresh,
  };
}
