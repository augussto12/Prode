import prisma from '../config/database.js';
import { createHash, randomUUID } from 'node:crypto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { createBetImportService } from './bet-imports/index.js';
import { parseStakeUrl, BetImportError } from './bet-imports/stake-argentina.importer.js';
import { combineBetOcrTexts, detectProviderFromText, readBetScreenshot, validateBetScreenshot } from './bet-screenshot.service.js';

export const MAX_SCREENSHOTS = 5;
export const BET_RESULTS = ['won', 'lost', 'void'];

const person = { id: true, username: true, displayName: true, avatar: true };
const membership = (userId) => ({ groupUsers: { some: { userId, isBanned: false } } });
const accessible = (userId) => ({ OR: [{ visibility: 'PUBLIC' }, { visibility: 'GROUP', group: membership(userId) }] });
const postInclude = (userId) => ({
  author: { select: person }, group: { select: { id: true, name: true, groupUsers: { where: { userId, isBanned: false }, select: { isAdmin: true } } } },
  ticket: { select: { snapshot: true } },
  selections: { orderBy: { position: 'asc' }, select: { event: true, startsAt: true, team: true, player: true, pick: true, odds: true, groupOdds: true } },
  screenshots: { orderBy: { position: 'asc' }, select: { id: true } },
  _count: { select: { comments: true, reactions: true, reports: true, linkOpens: true, anonymousLinkOpens: true } },
  reactions: { where: { userId }, select: { userId: true } },
  saves: { where: { userId }, select: { userId: true } },
});

function present(post, userId) {
  const admin = post.group?.groupUsers.some((member) => member.isAdmin) || false;
  return {
    id: post.id, sequence: post.sequence, content: post.content, originalUrl: post.originalUrl,
    provider: post.provider, importState: post.importState, createdAt: post.createdAt, updatedAt: post.updatedAt,
    author: post.author, group: post.group ? { id: post.group.id, name: post.group.name } : null,
    visibility: post.visibility, totalOdds: post.totalOdds?.toString() || null,
    result: post.result || null, settledAt: post.settledAt || null,
    selections: post.selections.map((selection) => ({ ...selection, odds: selection.odds?.toString() || null, groupOdds: selection.groupOdds?.toString() || null })),
    screenshots: post.screenshots.map((screenshot) => screenshot.id),
    ticket: post.ticket?.snapshot || null,
    commentCount: post._count.comments, reactionCount: post._count.reactions,
    linkOpenCount: post.authorId === userId ? post._count.linkOpens : undefined,
    anonymousLinkOpenCount: post.authorId === userId ? post._count.anonymousLinkOpens : undefined,
    reportCount: admin ? post._count.reports : undefined,
    reacted: post.reactions.length > 0, saved: post.saves.length > 0,
    canEdit: post.authorId === userId, canDelete: post.authorId === userId,
  };
}

async function requireMember(db, userId, groupId) {
  const member = await db.groupUser.findUnique({ where: { userId_groupId: { userId, groupId } } });
  if (!member || member.isBanned) throw new ForbiddenError('No tenés acceso a este grupo.');
  return member;
}

async function requirePost(db, userId, id) {
  const post = await db.betPost.findFirst({ where: { id, ...accessible(userId) } });
  if (!post) throw new NotFoundError('La publicación no está disponible.');
  return post;
}

// Each capture's OCR text is parsed and merged, so overlapping captures count once.
async function recognizeDraft(db, draftId, provider) {
  const screenshots = await db.betScreenshot.findMany({ where: { draftId }, orderBy: { position: 'asc' }, select: { id: true, image: true, mimeType: true, ocrText: true } });
  // 'auto' drafts take the bookmaker the screenshots show.
  const settle = async (detected) => {
    if (provider !== 'auto' || !detected) return provider;
    await db.betImportDraft.update({ where: { id: draftId }, data: { provider: detected } });
    return detected;
  };
  let ocrFailed = false;
  for (const screenshot of screenshots) if (!screenshot.ocrText) {
    try {
      screenshot.ocrText = (await readBetScreenshot(Buffer.from(screenshot.image), screenshot.mimeType, provider)).rawText || null;
      await db.betScreenshot.update({ where: { id: screenshot.id }, data: { ocrText: screenshot.ocrText } });
    } catch { ocrFailed = true; }
  }
  const detected = await settle(detectProviderFromText(screenshots.map((item) => item.ocrText || '').join('\n')));
  return { ...combineBetOcrTexts(screenshots.map((item) => item.ocrText), detected === 'auto' ? 'stake_pba' : detected), provider: detected, ocrFailed, source: 'ocr' };
}

export function detectProviderFromUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    const is = (domains) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (is(['pba.stake.bet.ar'])) return 'stake_pba';
    if (is(['bet365.com', 'bet365.bet.ar'])) return 'bet365';
    if (is(['betano.com', 'betano.bet.ar', 'betano.com.ar'])) return 'betano';
  } catch { /* validated below */ }
  return null;
}

function parseOtherBookmakerUrl(value, provider) {
  let url;
  try { url = new URL(value); } catch { throw new BadRequestError('Pegá un enlace válido de la casa de apuestas.'); }
  const host = url.hostname.toLowerCase();
  const allowed = provider === 'bet365'
    ? ['bet365.com', 'bet365.bet.ar']
    : provider === 'betano' ? ['betano.com', 'betano.bet.ar', 'betano.com.ar'] : [];
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new BadRequestError('El enlace debe ser HTTPS y pertenecer a la casa de apuestas elegida.');
  }
  if (value.length > 2048) throw new BadRequestError('El enlace es demasiado largo.');
  url.hash = '';
  return url.toString();
}

// Factory allows contract/integration tests with a recorded importer, never exposed
// as an HTTP parameter. Production uses only the real importer and explicit flag.
export function createBetCommunityService({ db = prisma, importer = createBetImportService(), importEnabled = () => process.env.STAKE_PBA_IMPORT_ENABLED === 'true' } = {}) {
  return {
    async preview(userId, { sharedUrl, groupId, provider = 'auto' }) {
      if (groupId) await requireMember(db, userId, groupId);
      if (provider === 'auto' && sharedUrl?.trim()) {
        provider = detectProviderFromUrl(sharedUrl.trim());
        if (!provider) throw new BadRequestError('El enlace tiene que ser de Stake, Bet365 o Betano.');
      }
      let originalUrl = `capture:${randomUUID()}`;
      if (sharedUrl?.trim()) {
        try { originalUrl = provider === 'stake_pba' ? parseStakeUrl(sharedUrl).originalUrl : parseOtherBookmakerUrl(sharedUrl, provider); }
        catch (error) {
          if (error instanceof BetImportError) throw new BadRequestError(error.message);
          throw error;
        }
      }
      if (await db.betPost.findFirst({ where: { authorId: userId, provider, originalUrl }, select: { id: true } })) {
        throw new BadRequestError('Ya publicaste este ticket. Podés encontrarlo en Mis apuestas.');
      }
      const result = provider === 'stake_pba' && sharedUrl?.trim() && importEnabled()
        ? await importer.import(originalUrl) : { state: 'not_accessible', code: 'SCREENSHOT_IMPORT' };
      const ready = result.state === 'ready';
      // Expired drafts also release their unpublished screenshots.
      await db.betImportDraft.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      const draft = await db.betImportDraft.create({ data: {
        userId, originalUrl, provider, state: ready ? 'ready' : 'link_only',
        failureCode: ready ? null : result.code,
        ...(ready ? { snapshot: result.ticket } : {}),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } });
      return { id: draft.id, state: draft.state, provider, originalUrl: draft.originalUrl, ticket: ready ? result.ticket : null,
        expiresAt: draft.expiresAt,
        message: ready ? 'Ticket importado. Revisalo antes de publicar.' : 'Subí las capturas para leer el ticket o publicá el enlace.',
      };
    },

    async addScreenshot(userId, draftId, image, mimeType) {
      validateBetScreenshot(image, mimeType);
      // Re-read below: an 'auto' draft learns its provider from the first screenshot.
      const draftWhere = { id: draftId, userId, consumedAt: null, expiresAt: { gt: new Date() } };
      const draft = await db.betImportDraft.findFirst({ where: draftWhere, select: { provider: true } });
      if (!draft) throw new BadRequestError('La vista previa venció. Volvé a empezar la carga.');
      const checksum = createHash('sha256').update(image).digest('hex');
      if (await db.betScreenshot.findFirst({ where: { checksum, OR: [{ draftId }, { post: { authorId: userId, provider: draft.provider } }] }, select: { id: true } })) {
        throw new BadRequestError('Esta captura ya está en el ticket o en una apuesta que publicaste.');
      }
      const tooMany = `Podés subir hasta ${MAX_SCREENSHOTS} capturas por ticket.`;
      if (await db.betScreenshot.count({ where: { draftId } }) >= MAX_SCREENSHOTS) throw new BadRequestError(tooMany);
      const screenshot = await db.$transaction(async (tx) => {
        const validDraft = await tx.betImportDraft.findFirst({ where: draftWhere, select: { id: true } });
        if (!validDraft) throw new BadRequestError('La vista previa venció. Volvé a empezar la carga.');
        if (await tx.betScreenshot.count({ where: { draftId } }) >= MAX_SCREENSHOTS) throw new BadRequestError(tooMany);
        const last = await tx.betScreenshot.findFirst({ where: { draftId }, orderBy: { position: 'desc' }, select: { position: true } });
        return tx.betScreenshot.create({ data: { draftId, position: (last?.position ?? -1) + 1, mimeType, image, checksum }, select: { id: true } });
      });
      return { id: screenshot.id, ...(await recognizeDraft(db, draftId, draft.provider)) };
    },

    async removeScreenshot(userId, draftId, screenshotId) {
      const draft = await db.betImportDraft.findFirst({ where: { id: draftId, userId, consumedAt: null, expiresAt: { gt: new Date() } }, select: { provider: true } });
      if (!draft) throw new BadRequestError('La vista previa venció. Volvé a empezar la carga.');
      await db.betScreenshot.deleteMany({ where: { id: screenshotId, draftId } });
      return recognizeDraft(db, draftId, draft.provider);
    },

    async settle(userId, id, result) {
      const updated = await db.betPost.updateMany({ where: { id, authorId: userId }, data: { result, settledAt: result ? new Date() : null } });
      if (!updated.count) throw new ForbiddenError('Solo quien publicó la apuesta puede cerrarla.');
      return this.get(userId, id);
    },

    async image(userId, imageId, publicOnly = false) {
      const screenshot = await db.betScreenshot.findFirst({ where: { id: imageId, post: publicOnly ? { visibility: 'PUBLIC' } : accessible(userId) }, select: { image: true, mimeType: true } });
      if (!screenshot) throw new NotFoundError('La captura no está disponible.');
      return screenshot;
    },

    async publish(userId, { draftId, groupId, content, totalOdds, selections }) {
      const id = await db.$transaction(async (tx) => {
        if (groupId) await requireMember(tx, userId, groupId);
        const draft = await tx.betImportDraft.findFirst({ where: { id: draftId, userId, consumedAt: null, expiresAt: { gt: new Date() } } });
        if (!draft) throw new BadRequestError('La vista previa venció o ya fue publicada. Volvé a leer el enlace.');
        if (await tx.betPost.findFirst({ where: { authorId: userId, provider: draft.provider, originalUrl: draft.originalUrl }, select: { id: true } })) {
          throw new BadRequestError('Ya publicaste este ticket. Podés encontrarlo en Mis apuestas.');
        }
        const claimed = await tx.betImportDraft.updateMany({ where: { id: draft.id, userId, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
        if (claimed.count !== 1) throw new BadRequestError('Esta vista previa ya fue publicada.');
        let ticketId = null;
        if (draft.state === 'ready' && draft.snapshot) {
          const snapshot = draft.snapshot;
          const ticket = await tx.betTicket.upsert({
            where: { provider_host_externalId: { provider: snapshot.provider, host: snapshot.host, externalId: snapshot.ticketUuid } },
            create: { provider: snapshot.provider, host: snapshot.host, externalId: snapshot.ticketUuid, originalOdds: snapshot.originalOdds, snapshot },
            update: {}, // Do not silently replace a historical snapshot.
          });
          ticketId = ticket.id;
        }
        const screenshots = await tx.betScreenshot.findMany({ where: { draftId: draft.id }, orderBy: { position: 'asc' }, select: { ocrText: true } });
        const screenshotCount = screenshots.length;
        const recognized = combineBetOcrTexts(screenshots.map((item) => item.ocrText), draft.provider);
        const linkOnly = !ticketId && !screenshotCount && (!selections || selections.length === 0) && draft.originalUrl.startsWith('https://');
        if (!ticketId && !screenshotCount && !linkOnly && (!selections || selections.length === 0)) throw new BadRequestError('Subí una captura o cargá una selección.');
        if (!ticketId && !screenshotCount && !linkOnly && !totalOdds) throw new BadRequestError('Indicá la cuota total del ticket.');
        const normalized = ticketId ? draft.snapshot.groups.flatMap((group) => group.selections.map((selection) => ({
          event: group.event, team: null, player: selection.player, groupOdds: group.groupOdds,
          pick: `${selection.market} ${selection.direction === 'over' ? 'más de' : 'menos de'} ${selection.line}`,
        }))) : selections?.length >= recognized.selections.length ? selections : recognized.selections;
        const post = await tx.betPost.create({ data: {
          authorId: userId, groupId: groupId || null, visibility: groupId ? 'GROUP' : 'PUBLIC', ticketId, content,
          originalUrl: draft.originalUrl, provider: draft.provider, importState: ticketId ? 'ready' : screenshotCount ? 'screenshot' : linkOnly ? 'link_only' : 'author_entered',
          totalOdds: ticketId ? draft.snapshot.originalOdds : totalOdds || recognized.totalOdds || null,
          selections: { create: normalized.map((selection, position) => ({ ...selection, position, startsAt: selection.startsAt || null, odds: selection.odds || null, groupOdds: selection.groupOdds || null })) },
        } });
        if (screenshotCount) await tx.betScreenshot.updateMany({ where: { draftId: draft.id }, data: { draftId: null, postId: post.id } });
        return post.id;
      }).catch((error) => {
        if (error.code === 'P2002') throw new BadRequestError('Ya publicaste este ticket. Podés encontrarlo en Mis apuestas.');
        throw error;
      });
      return this.get(userId, id);
    },

    async feed(userId, { groupId, scope = 'all', mode = 'all', before, query = '', kind = 'all', status = 'all' } = {}) {
      if (groupId) await requireMember(db, userId, groupId);
      const where = { ...(groupId ? { visibility: 'GROUP', groupId } : scope === 'public' ? { visibility: 'PUBLIC' } : scope === 'groups' ? { visibility: 'GROUP', group: membership(userId) } : accessible(userId)),
        ...(before ? { sequence: { lt: before } } : {}),
        ...(mode === 'mine' ? { authorId: userId } : {}),
        ...(mode === 'saved' ? { saves: { some: { userId } } } : {}),
        ...(kind !== 'all' ? { importState: kind } : {}),
        ...(status === 'open' ? { result: null } : status !== 'all' ? { result: status } : {}),
        ...(query ? { AND: [{ OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { author: { displayName: { contains: query, mode: 'insensitive' } } },
          { author: { username: { contains: query, mode: 'insensitive' } } },
          { selections: { some: { OR: [
            { event: { contains: query, mode: 'insensitive' } }, { team: { contains: query, mode: 'insensitive' } },
            { player: { contains: query, mode: 'insensitive' } }, { pick: { contains: query, mode: 'insensitive' } },
          ] } } },
          { screenshots: { some: { ocrText: { contains: query, mode: 'insensitive' } } } },
        ] }] } : {}),
      };
      const rows = await db.betPost.findMany({ where, include: postInclude(userId), orderBy: { sequence: 'desc' }, take: 21 });
      const items = rows.slice(0, 20).map((row) => {
        const item = present(row, userId);
        if (query) {
          const matches = item.selections.filter((selection) => [selection.event, selection.team, selection.player, selection.pick].some((value) => value?.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))));
          if (matches.length) item.selections = matches;
        }
        return item;
      });
      return { items, nextCursor: rows.length > 20 ? items.at(-1).sequence : null };
    },

    async publicFeed({ before, query = '' } = {}) {
      return this.feed(-1, { scope: 'public', before, query });
    },

    async get(userId, id) {
      const post = await db.betPost.findFirst({ where: { id, ...accessible(userId) }, include: postInclude(userId) });
      if (!post) throw new NotFoundError('La publicación no está disponible.');
      return present(post, userId);
    },

    async edit(userId, id, content) {
      const result = await db.betPost.updateMany({ where: { id, authorId: userId, ...accessible(userId) }, data: { content } });
      if (!result.count) throw new ForbiddenError('No podés editar esta publicación.');
      return this.get(userId, id);
    },

    async remove(userId, id) {
      const result = await db.betPost.deleteMany({ where: { id, authorId: userId, ...accessible(userId) } });
      if (!result.count) throw new ForbiddenError('No podés eliminar esta publicación.');
    },

    async comments(userId, postId, after) {
      await requirePost(db, userId, postId);
      const rows = await db.betComment.findMany({ where: { postId, post: accessible(userId), ...(after ? { id: { gt: after } } : {}) },
        include: { author: { select: person } }, orderBy: { id: 'asc' }, take: 31 });
      return { items: rows.slice(0, 30).map(({ id, content, createdAt, author }) => ({ id, content, createdAt, author })), nextCursor: rows.length > 30 ? rows[29].id : null };
    },

    async comment(userId, postId, content) {
      return db.$transaction(async (tx) => {
        await requirePost(tx, userId, postId);
        return tx.betComment.create({ data: { postId, authorId: userId, content }, select: { id: true, content: true, createdAt: true, author: { select: person } } });
      });
    },

    async deleteComment(userId, postId, commentId) {
      await db.$transaction(async (tx) => {
        const post = await requirePost(tx, userId, postId);
        const member = post.groupId ? await requireMember(tx, userId, post.groupId) : null;
        const result = await tx.betComment.deleteMany({ where: { id: commentId, postId, ...(member?.isAdmin ? {} : { authorId: userId }) } });
        if (!result.count) throw new ForbiddenError('No podés eliminar este comentario.');
      });
    },

    async toggle(userId, postId, type, active) {
      await db.$transaction(async (tx) => {
        await requirePost(tx, userId, postId);
        const table = type === 'reaction' ? tx.betReaction : tx.savedBetPost;
        if (active) await table.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId }, update: {} });
        else await table.deleteMany({ where: { postId, userId } });
      });
      return this.get(userId, postId);
    },

    async openLink(userId, postId) {
      const post = await requirePost(db, userId, postId);
      if (!post.originalUrl.startsWith('https://')) throw new BadRequestError('Este ticket no tiene un enlace original.');
      if (post.authorId !== userId) {
        await db.betLinkOpen.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId }, update: {} });
      }
    },

    async openAnonymousLink(postId, visitorKey) {
      const post = await db.betPost.findFirst({ where: { id: postId, visibility: 'PUBLIC' }, select: { id: true, originalUrl: true } });
      if (!post) throw new NotFoundError('La publicación no está disponible.');
      if (!post.originalUrl.startsWith('https://')) throw new BadRequestError('Este ticket no tiene un enlace original.');
      await db.betAnonymousLinkOpen.upsert({ where: { postId_visitorKey: { postId, visitorKey } }, create: { postId, visitorKey }, update: {} });
    },

    async report(userId, postId, reason) {
      await db.$transaction(async (tx) => {
        await requirePost(tx, userId, postId);
        await tx.betReport.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId, reason }, update: { reason } });
      });
    },

    async reports(userId, postId) {
      const post = await requirePost(db, userId, postId);
      if (!post.groupId || !(await requireMember(db, userId, post.groupId)).isAdmin) throw new ForbiddenError('Solo los administradores del grupo pueden ver reportes.');
      return db.betReport.findMany({ where: { postId }, select: { id: true, reason: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    },
  };
}

export default createBetCommunityService();
