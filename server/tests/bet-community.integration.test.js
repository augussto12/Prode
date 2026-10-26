import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import prisma from '../src/config/database.js';
import { createBetCommunityService } from '../src/services/bet-community.service.js';
import { normalizeStakeResponse, parseStakeUrl } from '../src/services/bet-imports/stake-argentina.importer.js';
import { createGroup, getLeaderboard, getActivity, getMatchPredictions } from '../src/services/group.service.js';

// Opt-in: creates only uniquely named temporary records and removes those IDs.
// Never resets the database or modifies an existing user's account/group.
test('community end-to-end persistence and access isolation', { skip: process.env.RUN_COMMUNITY_DB_TESTS !== 'true', timeout: 120000 }, async (t) => {
  const users = []; const groupIds = []; const ticketIds = [];
  const suffix = randomUUID().slice(0, 8);
  const originalUrl = 'https://pba.stake.bet.ar/sports/home?betId=e3351002-10aa-43bd-812f-751e71d2f637&iid=sport%3A899911';
  const offline = createBetCommunityService({ importEnabled: () => false });
  let server;
  try {
    for (let i = 0; i < 3; i++) users.push(await prisma.user.create({ data: {
      email: `community-test-${suffix}-${i}@example.invalid`, username: `ct_${suffix}_${i}`, displayName: `QA ${i}`,
      password: 'NOT_A_LOGIN_HASH', emailVerifiedAt: new Date(),
    } }));
    const [owner, friend, outsider] = users;
    const group = await createGroup(owner.id, { name: `QA community ${suffix}`, isPublic: true }); groupIds.push(group.id);
    const otherGroup = await createGroup(outsider.id, { name: `QA isolated ${suffix}` }); groupIds.push(otherGroup.id);
    await prisma.groupUser.create({ data: { userId: friend.id, groupId: group.id } });
    let post;

    await t.test('groups can exist without a tournament and preserve member lists', async () => {
      assert.equal(group.competitionId, null);
      assert.equal((await getLeaderboard(group.id)).length, 2);
      assert.deepEqual(await getActivity(group.id), []);
      await assert.rejects(getMatchPredictions(group.id, '123', owner.id), { statusCode: 400 });
    });
    await t.test('preview validates membership and URL; fallback is explicit and private', async () => {
      await assert.rejects(offline.preview(outsider.id, { sharedUrl: originalUrl, groupId: group.id }), { statusCode: 403 });
      await assert.rejects(offline.preview(owner.id, { sharedUrl: 'http://localhost/internal', groupId: group.id }), { statusCode: 400 });
      const draft = await offline.preview(owner.id, { sharedUrl: originalUrl, groupId: group.id });
      assert.equal(draft.state, 'link_only'); assert.equal(draft.ticket, null);
      await assert.rejects(offline.publish(friend.id, { draftId: draft.id, groupId: group.id, content: 'stolen' }), { statusCode: 400 });
      post = await offline.publish(owner.id, { draftId: draft.id, groupId: group.id, content: 'Ticket para conversar' });
      assert.equal(post.importState, 'link_only'); assert.equal(post.ticket, null);
      await assert.rejects(offline.publish(owner.id, { draftId: draft.id, groupId: group.id, content: 'replay' }), { statusCode: 400 });
    });
    await t.test('only members can list, open, comment, save or react even in a publicly listed group', async () => {
      assert.equal((await offline.feed(friend.id, { groupId: group.id })).items[0].id, post.id);
      assert.equal((await offline.feed(outsider.id)).items.some((item) => item.id === post.id), false);
      await assert.rejects(offline.get(outsider.id, post.id), { statusCode: 404 });
      await assert.rejects(offline.comments(outsider.id, post.id), { statusCode: 404 });
      await assert.rejects(offline.comment(outsider.id, post.id, 'hidden'), { statusCode: 404 });
      await assert.rejects(offline.toggle(outsider.id, post.id, 'save', true), { statusCode: 404 });
      await assert.rejects(offline.toggle(outsider.id, post.id, 'reaction', true), { statusCode: 404 });
      await assert.rejects(offline.edit(friend.id, post.id, 'changed'), { statusCode: 403 });
    });
    await t.test('comments, reactions, saves and filters persist without exposing account fields', async () => {
      const comment = await offline.comment(friend.id, post.id, 'Me interesa este partido.');
      assert.equal((await offline.comments(owner.id, post.id)).items[0].id, comment.id);
      await offline.toggle(friend.id, post.id, 'reaction', true);
      assert.equal((await offline.toggle(friend.id, post.id, 'reaction', true)).reactionCount, 1);
      await offline.toggle(friend.id, post.id, 'save', true);
      assert.equal((await offline.feed(friend.id, { mode: 'saved' })).items[0].id, post.id);
      assert.equal((await offline.feed(owner.id, { mode: 'saved' })).items.length, 0);
      assert.equal((await offline.feed(friend.id, { mode: 'mine' })).items.length, 0);
      const visible = await offline.get(friend.id, post.id);
      assert.equal(visible.commentCount, 1);
      assert.equal(visible.reportCount, undefined);
      assert.doesNotMatch(JSON.stringify(visible), /example.invalid|password|email|NOT_A_LOGIN_HASH/);
      await offline.deleteComment(friend.id, post.id, comment.id);
      assert.equal((await offline.comments(owner.id, post.id)).items.length, 0);
    });
    await t.test('reports are visible only to group admins', async () => {
      await offline.report(friend.id, post.id, 'Revisar contenido de prueba');
      await assert.rejects(offline.reports(friend.id, post.id), { statusCode: 403 });
      assert.equal((await offline.reports(owner.id, post.id))[0].reason, 'Revisar contenido de prueba');
      assert.equal((await offline.get(owner.id, post.id)).reportCount, 1);
    });
    await t.test('banned users lose saved-post and direct access immediately', async () => {
      await prisma.groupUser.update({ where: { userId_groupId: { userId: friend.id, groupId: group.id } }, data: { isBanned: true } });
      assert.equal((await offline.feed(friend.id, { mode: 'saved' })).items.length, 0);
      await assert.rejects(offline.get(friend.id, post.id), { statusCode: 404 });
      await assert.rejects(offline.toggle(friend.id, post.id, 'reaction', false), { statusCode: 404 });
      await prisma.groupUser.update({ where: { userId_groupId: { userId: friend.id, groupId: group.id } }, data: { isBanned: false } });
    });
    await t.test('expired previews cannot be published', async () => {
      const draft = await offline.preview(owner.id, { sharedUrl: originalUrl, groupId: group.id });
      await prisma.betImportDraft.update({ where: { id: draft.id }, data: { expiresAt: new Date(0) } });
      await assert.rejects(offline.publish(owner.id, { draftId: draft.id, groupId: group.id, content: '' }), { statusCode: 400 });
    });
    await t.test('same imported ticket is stored once while posts/comments remain separate', async () => {
      const payload = JSON.parse(readFileSync(new URL('./fixtures/stake/stake_899911_graphql_response_original_sanitizada.json', import.meta.url), 'utf8'));
      const snapshot = normalizeStakeResponse(payload, parseStakeUrl(originalUrl));
      // Separate test identity avoids touching any real imported ticket.
      snapshot.ticketUuid = randomUUID();
      const recorded = createBetCommunityService({ importEnabled: () => true, importer: { import: async () => ({ state: 'ready', ticket: snapshot }) } });
      const publishFor = async (userId, groupId) => {
        const draft = await recorded.preview(userId, { sharedUrl: originalUrl, groupId });
        return recorded.publish(userId, { draftId: draft.id, groupId, content: 'Recorded contract test' });
      };
      const a = await publishFor(owner.id, group.id);
      const storedA = await prisma.betPost.findUnique({ where: { id: a.id } }); ticketIds.push(storedA.ticketId);
      const b = await publishFor(outsider.id, otherGroup.id);
      const storedB = await prisma.betPost.findUnique({ where: { id: b.id } });
      assert.equal(storedA.ticketId, storedB.ticketId);
      assert.equal(a.ticket.selectionCount, 8); assert.equal(a.ticket.groupsCount, 4);
      assert.equal(a.ticket.originalOdds, '27.078583');
      await offline.comment(friend.id, a.id, 'Solo en nuestro grupo');
      assert.equal((await offline.comments(outsider.id, b.id)).items.length, 0);
      await assert.rejects(offline.get(outsider.id, a.id), { statusCode: 404 });
    });
    await t.test('HTTP API enforces authentication, request shape and group boundaries', async () => {
      const { default: app } = await import('../src/app.js');
      const { generateToken } = await import('../src/utils/jwt.js');
      server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
      const base = `http://127.0.0.1:${server.address().port}/api/community`;
      assert.equal((await fetch(`${base}/posts`)).status, 401);
      const headers = { Authorization: `Bearer ${generateToken(owner)}`, 'Content-Type': 'application/json' };
      assert.equal((await fetch(`${base}/posts`, { headers })).status, 200);
      assert.equal((await fetch(`${base}/posts`, { headers, method: 'POST', body: JSON.stringify({ draftId: randomUUID(), groupId: group.id, content: '', ticket: { amount: 999 } }) })).status, 400);
      assert.equal((await fetch(`${base}/posts/${post.id}`, { headers: { Authorization: `Bearer ${generateToken(outsider)}` } })).status, 404);
    });
    await t.test('author deletes own post and related records are removed', async () => {
      await assert.rejects(offline.remove(friend.id, post.id), { statusCode: 403 });
      await offline.remove(owner.id, post.id);
      assert.equal(await prisma.savedBetPost.count({ where: { postId: post.id } }), 0);
      await assert.rejects(offline.get(owner.id, post.id), { statusCode: 404 });
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await prisma.betTicket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.$disconnect();
  }
});
