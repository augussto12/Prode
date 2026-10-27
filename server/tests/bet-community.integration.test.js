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
    let post; let screenshotId; let privateScreenshotId;

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
      post = await offline.publish(owner.id, { draftId: draft.id, groupId: group.id, content: 'Ticket para conversar', totalOdds: '3.25', selections: [{ event: 'Warriors vs Lakers', team: 'Warriors', player: 'Stephen Curry', pick: 'Más de 3 triples', odds: '1.80' }] });
      assert.equal(post.importState, 'author_entered'); assert.equal(post.ticket, null);
      assert.equal(post.selections[0].team, 'Warriors');
      await assert.rejects(offline.preview(owner.id, { sharedUrl: originalUrl, groupId: group.id }), { statusCode: 400 });
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
    await t.test('public bets appear to everyone and search finds individual selections', async () => {
      const publicUrl = originalUrl.replace('e3351002-10aa-43bd-812f-751e71d2f637', randomUUID());
      const draft = await offline.preview(owner.id, { sharedUrl: publicUrl });
      const publicPost = await offline.publish(owner.id, { draftId: draft.id, content: 'Para todos', totalOdds: '5.4', selections: [
        { event: 'Warriors vs Lakers', team: 'Warriors', player: 'Stephen Curry', pick: 'Más de 3 triples', odds: '1.8', groupOdds: '1.50' },
        { event: 'Celtics vs Heat', team: 'Celtics', player: 'Jayson Tatum', pick: 'Más de 20 puntos', odds: '2.2' },
      ] });
      assert.equal(publicPost.group, null);
      assert.equal(publicPost.totalOdds, '5.4');
      assert.equal(publicPost.selections[0].groupOdds, '1.5');
      assert.equal((await offline.publicFeed()).items.some((item) => item.id === publicPost.id), true);
      const found = (await offline.publicFeed({ query: 'Warriors' })).items.find((item) => item.id === publicPost.id);
      assert.equal(found.selections.length, 1);
      assert.equal(found.selections[0].player, 'Stephen Curry');
      assert.equal(found.totalOdds, '5.4');
      assert.equal((await offline.publicFeed({ query: 'Tatum' })).items.some((item) => item.id === publicPost.id), true);
      assert.equal((await offline.publicFeed({ query: 'Bulls' })).items.some((item) => item.id === publicPost.id), false);
      await assert.rejects(offline.preview(owner.id, { sharedUrl: publicUrl }), { statusCode: 400 });
    });
    await t.test('Bet365 and Betano shared links publish once without inventing selections', async () => {
      for (const [provider, host] of [['bet365', 'www.bet365.com'], ['betano', 'www.betano.com']]) {
        const url = `https://${host}/share/${randomUUID()}`;
        await assert.rejects(offline.preview(owner.id, { provider, sharedUrl: `https://${host}.evil.test/share/1` }), { statusCode: 400 });
        await assert.rejects(offline.preview(owner.id, { provider, sharedUrl: `http://${host}/share/1` }), { statusCode: 400 });
        const draft = await offline.preview(owner.id, { provider, sharedUrl: url });
        const bet = await offline.publish(owner.id, { draftId: draft.id, content: '' });
        assert.equal(bet.importState, 'link_only');
        assert.equal(bet.originalUrl, url);
        assert.deepEqual(bet.selections, []);
        assert.equal(bet.totalOdds, null);
        await assert.rejects(offline.preview(owner.id, { provider, sharedUrl: url }), { statusCode: 400 });
      }
    });
    await t.test('a capture can be published without a required selection or odds', async () => {
      const captureUrl = originalUrl.replace('e3351002-10aa-43bd-812f-751e71d2f637', randomUUID());
      const draft = await offline.preview(owner.id, { sharedUrl: captureUrl });
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64');
      await assert.rejects(offline.addScreenshot(friend.id, draft.id, image, 'image/png'), { statusCode: 400 });
      const upload = await offline.addScreenshot(owner.id, draft.id, image, 'image/png');
      screenshotId = upload.id;
      assert.ok(upload.id);
      const published = await offline.publish(owner.id, { draftId: draft.id, content: 'Solo la captura' });
      assert.equal(published.importState, 'screenshot');
      assert.deepEqual(published.selections, []);
      assert.equal(published.totalOdds, null);
      assert.deepEqual(published.screenshots, [upload.id]);
      assert.deepEqual(Buffer.from((await offline.image(-1, upload.id, true)).image), image);
      await assert.rejects(offline.preview(owner.id, { sharedUrl: captureUrl }), { statusCode: 400 });
      const privateUrl = originalUrl.replace('e3351002-10aa-43bd-812f-751e71d2f637', randomUUID());
      const privateDraft = await offline.preview(owner.id, { sharedUrl: privateUrl, groupId: group.id });
      privateScreenshotId = (await offline.addScreenshot(owner.id, privateDraft.id, Buffer.concat([image, Buffer.from([1])]), 'image/png')).id;
      await offline.publish(owner.id, { draftId: privateDraft.id, groupId: group.id, content: 'Captura del grupo' });
      await assert.rejects(offline.image(-1, privateScreenshotId, true), { statusCode: 404 });
      await assert.rejects(offline.image(outsider.id, privateScreenshotId), { statusCode: 404 });
    });
    await t.test('expired previews cannot be published', async () => {
      const draft = await offline.preview(owner.id, { sharedUrl: originalUrl.replace('e3351002-10aa-43bd-812f-751e71d2f637', randomUUID()), groupId: group.id });
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
      const a = await publishFor(friend.id, group.id);
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
      const publicResponse = await fetch(`${base}/public?query=Warriors`);
      assert.equal(publicResponse.status, 200);
      const publicItems = (await publicResponse.json()).items;
      assert.equal(publicItems.some((item) => item.id === post.id), false);
      assert.equal(publicItems.some((item) => item.selections[0]?.team === 'Warriors'), true);
      assert.equal((await fetch(`${base}/public/images/${screenshotId}`)).status, 200);
      assert.equal((await fetch(`${base}/public/images/${privateScreenshotId}`)).status, 404);
      const headers = { Authorization: `Bearer ${generateToken(owner)}`, 'Content-Type': 'application/json' };
      assert.equal((await fetch(`${base}/posts`, { headers })).status, 200);
      assert.equal((await fetch(`${base}/imports`, { headers, method: 'POST', body: JSON.stringify({ provider: 'bet365' }) })).status, 201);
      assert.equal((await fetch(`${base}/imports`, { headers, method: 'POST', body: JSON.stringify({ sharedUrl: originalUrl }) })).status, 400);
      assert.equal((await fetch(`${base}/posts`, { headers, method: 'POST', body: JSON.stringify({ draftId: randomUUID(), groupId: group.id, content: '', ticket: { amount: 999 } }) })).status, 400);
      assert.equal((await fetch(`${base}/posts/${post.id}`, { headers: { Authorization: `Bearer ${generateToken(outsider)}` } })).status, 404);
    });
    await t.test('author deletes own post and related records are removed', async () => {
      await assert.rejects(offline.remove(friend.id, post.id), { statusCode: 403 });
      await offline.remove(owner.id, post.id);
      assert.equal(await prisma.savedBetPost.count({ where: { postId: post.id } }), 0);
      await assert.rejects(offline.get(owner.id, post.id), { statusCode: 404 });
    });
    await t.test('Betano screenshots need no link and even a group admin cannot delete another author’s bet', async () => {
      const draft = await offline.preview(friend.id, { provider: 'betano', groupId: group.id });
      assert.match(draft.originalUrl, /^capture:/);
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64');
      await offline.addScreenshot(friend.id, draft.id, image, 'image/png');
      const bet = await offline.publish(friend.id, { draftId: draft.id, groupId: group.id, content: '' });
      assert.equal(bet.provider, 'betano');
      assert.equal(bet.canDelete, true);
      assert.equal((await offline.get(owner.id, bet.id)).canDelete, false);
      await assert.rejects(offline.remove(owner.id, bet.id), { statusCode: 403 });
      const duplicateDraft = await offline.preview(friend.id, { provider: 'betano', groupId: group.id });
      await assert.rejects(offline.addScreenshot(friend.id, duplicateDraft.id, image, 'image/png'), { statusCode: 400 });
      await offline.remove(friend.id, bet.id);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await prisma.betTicket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.$disconnect();
  }
});
