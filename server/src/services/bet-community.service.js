import prisma from '../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { createBetImportService } from './bet-imports/index.js';
import { parseStakeUrl, BetImportError } from './bet-imports/stake-argentina.importer.js';

const person = { id: true, username: true, displayName: true, avatar: true };
const membership = (userId) => ({ groupUsers: { some: { userId, isBanned: false } } });
const accessible = (userId) => ({ OR: [{ visibility: 'PUBLIC' }, { visibility: 'GROUP', group: membership(userId) }] });
const postInclude = (userId) => ({
  author: { select: person }, group: { select: { id: true, name: true, groupUsers: { where: { userId, isBanned: false }, select: { isAdmin: true } } } },
  ticket: { select: { snapshot: true } },
  selections: { orderBy: { position: 'asc' }, select: { event: true, team: true, player: true, pick: true, odds: true } },
  _count: { select: { comments: true, reactions: true, reports: true } },
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
    selections: post.selections.map((selection) => ({ ...selection, odds: selection.odds?.toString() || null })),
    ticket: post.ticket?.snapshot || null,
    commentCount: post._count.comments, reactionCount: post._count.reactions,
    reportCount: admin ? post._count.reports : undefined,
    reacted: post.reactions.length > 0, saved: post.saves.length > 0,
    canEdit: post.authorId === userId, canDelete: post.authorId === userId || admin,
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

// Factory allows contract/integration tests with a recorded importer, never exposed
// as an HTTP parameter. Production uses only the real importer and explicit flag.
export function createBetCommunityService({ db = prisma, importer = createBetImportService(), importEnabled = () => process.env.STAKE_PBA_IMPORT_ENABLED === 'true' } = {}) {
  return {
    async preview(userId, { sharedUrl, groupId }) {
      if (groupId) await requireMember(db, userId, groupId);
      let parsed;
      try { parsed = parseStakeUrl(sharedUrl); }
      catch (error) {
        if (error instanceof BetImportError) throw new BadRequestError(error.message);
        throw error;
      }
      if (await db.betPost.findFirst({ where: { authorId: userId, provider: 'stake_pba', originalUrl: parsed.originalUrl }, select: { id: true } })) {
        throw new BadRequestError('Ya publicaste este ticket. Podés encontrarlo en Mis apuestas.');
      }
      const result = importEnabled() ? await importer.import(parsed.originalUrl) : { state: 'not_accessible', code: 'IMPORT_DISABLED' };
      const ready = result.state === 'ready';
      // Prune only this user's expired previews; never persist failed raw payloads.
      await db.betImportDraft.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
      const draft = await db.betImportDraft.create({ data: {
        userId, originalUrl: parsed.originalUrl, provider: 'stake_pba', state: ready ? 'ready' : 'link_only',
        failureCode: ready ? null : result.code,
        ...(ready ? { snapshot: result.ticket } : {}),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } });
      return { id: draft.id, state: draft.state, originalUrl: draft.originalUrl, ticket: ready ? result.ticket : null,
        expiresAt: draft.expiresAt,
        message: ready ? 'Ticket importado. Revisalo antes de publicar.' : 'No pudimos importar el detalle. Podés compartir el enlace original con tu grupo.',
      };
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
        if (!ticketId && (!selections || selections.length === 0)) throw new BadRequestError('Cargá al menos una selección antes de publicar.');
        if (!ticketId && !totalOdds) throw new BadRequestError('Indicá la cuota total del ticket.');
        const normalized = ticketId ? draft.snapshot.groups.flatMap((group) => group.selections.map((selection) => ({
          event: group.event, team: null, player: selection.player,
          pick: `${selection.market} ${selection.direction === 'over' ? 'más de' : 'menos de'} ${selection.line}`,
        }))) : selections;
        const post = await tx.betPost.create({ data: {
          authorId: userId, groupId: groupId || null, visibility: groupId ? 'GROUP' : 'PUBLIC', ticketId, content,
          originalUrl: draft.originalUrl, provider: draft.provider, importState: ticketId ? 'ready' : 'author_entered',
          totalOdds: ticketId ? draft.snapshot.originalOdds : totalOdds || null,
          selections: { create: normalized.map((selection, position) => ({ ...selection, position, odds: selection.odds || null })) },
        } });
        return post.id;
      }).catch((error) => {
        if (error.code === 'P2002') throw new BadRequestError('Ya publicaste este ticket. Podés encontrarlo en Mis apuestas.');
        throw error;
      });
      return this.get(userId, id);
    },

    async feed(userId, { groupId, scope = 'all', mode = 'all', before, query = '', kind = 'all' } = {}) {
      if (groupId) await requireMember(db, userId, groupId);
      const where = { ...(groupId ? { visibility: 'GROUP', groupId } : scope === 'public' ? { visibility: 'PUBLIC' } : scope === 'groups' ? { visibility: 'GROUP', group: membership(userId) } : accessible(userId)),
        ...(before ? { sequence: { lt: before } } : {}),
        ...(mode === 'mine' ? { authorId: userId } : {}),
        ...(mode === 'saved' ? { saves: { some: { userId } } } : {}),
        ...(kind !== 'all' ? { importState: kind } : {}),
        ...(query ? { AND: [{ OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { author: { displayName: { contains: query, mode: 'insensitive' } } },
          { author: { username: { contains: query, mode: 'insensitive' } } },
          { selections: { some: { OR: [
            { event: { contains: query, mode: 'insensitive' } }, { team: { contains: query, mode: 'insensitive' } },
            { player: { contains: query, mode: 'insensitive' } }, { pick: { contains: query, mode: 'insensitive' } },
          ] } } },
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
      const result = await db.betPost.deleteMany({ where: { id, AND: [accessible(userId), { OR: [
        { authorId: userId }, { group: { groupUsers: { some: { userId, isAdmin: true, isBanned: false } } } },
      ] }] } });
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
