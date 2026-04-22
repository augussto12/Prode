import * as groupService from '../services/group.service.js';

export async function create(req, res, next) {
  try {
    const group = await groupService.createGroup(req.user.id, req.body);
    res.status(201).json(group);
  } catch (err) { next(err); }
}

export async function getMyGroups(req, res, next) {
  try {
    const groups = await groupService.getMyGroups(req.user.id);
    res.json(groups);
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const group = await groupService.getGroupById(Number(req.params.id), req.user.id);
    res.json(group);
  } catch (err) { next(err); }
}

export async function join(req, res, next) {
  try {
    // inviteCode ya está validado como UUID por joinGroupSchema
    const { inviteCode } = req.body;
    const group = await groupService.joinGroup(req.user.id, inviteCode);
    res.json(group);
  } catch (err) { next(err); }
}

export async function leave(req, res, next) {
  try {
    await groupService.leaveGroup(req.user.id, Number(req.params.id));
    res.json({ message: 'Left group successfully' });
  } catch (err) { next(err); }
}

export async function removeGroup(req, res, next) {
  try {
    await groupService.deleteGroup(req.user.id, Number(req.params.id));
    res.json({ message: 'Group deleted successfully' });
  } catch (err) { next(err); }
}

export async function getLeaderboard(req, res, next) {
  try {
    const leaderboard = await groupService.getLeaderboard(Number(req.params.id));
    res.json(leaderboard);
  } catch (err) { next(err); }
}

export async function updateTheme(req, res, next) {
  try {
    const group = await groupService.updateGroupTheme(Number(req.params.id), req.user.id, req.body);
    res.json(group);
  } catch (err) { next(err); }
}

export async function getPublic(req, res, next) {
  try {
    const groups = await groupService.getPublicGroups();
    res.json(groups);
  } catch (err) { next(err); }
}

export async function removeMember(req, res, next) {
  try {
    await groupService.removeMember(Number(req.params.id), Number(req.params.userId), req.user.id);
    res.json({ message: 'Member banned successfully' });
  } catch (err) { next(err); }
}

export async function getBanned(req, res, next) {
  try {
    const banned = await groupService.getBannedMembers(Number(req.params.id), req.user.id);
    res.json(banned);
  } catch (err) { next(err); }
}

export async function unban(req, res, next) {
  try {
    await groupService.unbanMember(Number(req.params.id), Number(req.params.userId), req.user.id);
    res.json({ message: 'Member unbanned successfully' });
  } catch (err) { next(err); }
}

export async function getMatchPredictions(req, res, next) {
  try {
    const preds = await groupService.getMatchPredictions(Number(req.params.id), String(req.params.externalFixtureId));
    res.json(preds);
  } catch (err) { next(err); }
}
