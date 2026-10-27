import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import service from '../services/bet-community.service.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';
import { ANONYMOUS_BET_COOKIE, anonymousBetVisitor } from '../utils/anonymous-bet-visitor.js';

const router = Router();
const id = z.string().uuid();
const positive = z.coerce.number().int().positive().max(2147483647);
const content = z.string().trim().max(2000);
const odds = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,12})?$/).refine((value) => Number(value) >= 1 && Number(value) <= 1000000);
const selection = z.object({
  event: z.string().trim().min(2).max(200), team: z.string().trim().max(100).nullable(),
  player: z.string().trim().max(100).nullable(), pick: z.string().trim().min(2).max(200), odds: odds.nullable(), groupOdds: odds.nullable().optional(),
}).strict();
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestError('Revisá los campos: el enlace, el grupo o el texto no son válidos.');
  return result.data;
};
const action = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };

router.get('/public', action(async (req, res) => {
  const query = parse(z.object({ before: positive.optional(), query: z.string().trim().max(100).default('') }).strict(), req.query);
  res.json(await service.publicFeed(query));
}));
router.get('/public/images/:imageId', action(async (req, res) => {
  const image = await service.image(-1, parse(id, req.params.imageId), true);
  res.type(image.mimeType).send(Buffer.from(image.image));
}));
const anonymousOpenLimit = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false });
router.post('/public/posts/:postId/link-open', anonymousOpenLimit, action(async (req, res) => {
  const allowedOrigins = [process.env.FRONTEND_URL?.replace(/\/$/, ''),
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'])];
  if (!req.headers.origin || !allowedOrigins.includes(req.headers.origin)) throw new ForbiddenError('Origen de solicitud no permitido.');
  const postId = parse(id, req.params.postId);
  const visitor = anonymousBetVisitor(req.cookies?.[ANONYMOUS_BET_COOKIE], process.env.JWT_SECRET);
  await service.openAnonymousLink(postId, visitor.visitorKey);
  if (visitor.fresh) res.cookie(ANONYMOUS_BET_COOKIE, visitor.cookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/api/community/public/posts', maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  res.sendStatus(204);
}));
router.use(authenticate);
// Cookie-authenticated writes must originate in our frontend; requests without an
// Origin remain available to authenticated native/CLI clients.
router.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    const allowed = [process.env.FRONTEND_URL?.replace(/\/$/, ''),
      ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'])];
    if (!allowed.includes(req.headers.origin)) return next(new ForbiddenError('Origen de solicitud no permitido.'));
  }
  next();
});
const importLimit = rateLimit({ windowMs: 60000, limit: 5, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false, message: { error: 'Esperá un minuto antes de leer otro enlace.' } });
const writeLimit = rateLimit({ windowMs: 60000, limit: 30, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false, message: { error: 'Estás publicando muy rápido. Esperá un minuto.' } });
router.use((req, res, next) => req.method === 'GET' ? next() : writeLimit(req, res, next));

router.post('/imports', importLimit, action(async (req, res) => {
  const body = parse(z.object({ provider: z.enum(['stake_pba', 'bet365', 'betano']).default('stake_pba'), sharedUrl: z.string().max(2048).optional(), groupId: positive.optional() }).strict(), req.body);
  res.status(201).json(await service.preview(req.user.id, body));
}));
router.post('/scan', importLimit, action(async (req, res) => {
  const query = parse(z.object({ draftId: id }).strict(), req.query);
  res.json(await service.addScreenshot(req.user.id, query.draftId, req.body, req.headers['content-type']));
}));
router.get('/images/:imageId', action(async (req, res) => {
  const image = await service.image(req.user.id, parse(id, req.params.imageId));
  res.type(image.mimeType).send(Buffer.from(image.image));
}));
router.get('/posts', action(async (req, res) => {
  const query = parse(z.object({ groupId: positive.optional(), scope: z.enum(['all', 'public', 'groups']).default('all'), before: positive.optional(), mode: z.enum(['all', 'mine', 'saved']).default('all'), query: z.string().trim().max(100).default(''), kind: z.enum(['all', 'ready', 'author_entered', 'screenshot', 'link_only']).default('all') }).strict(), req.query);
  res.json(await service.feed(req.user.id, query));
}));
router.post('/posts', action(async (req, res) => {
  res.status(201).json(await service.publish(req.user.id, parse(z.object({ draftId: id, groupId: positive.optional(), content: content.default(''), totalOdds: odds.nullable().optional(), selections: z.array(selection).min(1).max(40).optional() }).strict(), req.body)));
}));
router.param('postId', (req, res, next, value) => { try { parse(id, value); next(); } catch (error) { next(error); } });
router.get('/posts/:postId', action(async (req, res) => res.json(await service.get(req.user.id, req.params.postId))));
router.patch('/posts/:postId', action(async (req, res) => res.json(await service.edit(req.user.id, req.params.postId, parse(z.object({ content }).strict(), req.body).content))));
router.delete('/posts/:postId', action(async (req, res) => { await service.remove(req.user.id, req.params.postId); res.sendStatus(204); }));
router.post('/posts/:postId/link-open', action(async (req, res) => { await service.openLink(req.user.id, req.params.postId); res.sendStatus(204); }));
router.get('/posts/:postId/comments', action(async (req, res) => res.json(await service.comments(req.user.id, req.params.postId, parse(z.object({ after: positive.optional() }).strict(), req.query).after))));
router.post('/posts/:postId/comments', action(async (req, res) => res.status(201).json(await service.comment(req.user.id, req.params.postId, parse(z.object({ content: content.min(1).max(1000) }).strict(), req.body).content))));
router.delete('/posts/:postId/comments/:commentId', action(async (req, res) => { await service.deleteComment(req.user.id, req.params.postId, parse(positive, req.params.commentId)); res.sendStatus(204); }));
for (const type of ['reaction', 'save']) router.put(`/posts/:postId/${type}`, action(async (req, res) => res.json(await service.toggle(req.user.id, req.params.postId, type, parse(z.object({ active: z.boolean() }).strict(), req.body).active))));
router.post('/posts/:postId/reports', action(async (req, res) => { await service.report(req.user.id, req.params.postId, parse(z.object({ reason: content.min(3).max(500) }).strict(), req.body).reason); res.sendStatus(204); }));
router.get('/posts/:postId/reports', action(async (req, res) => res.json(await service.reports(req.user.id, req.params.postId))));

export default router;
