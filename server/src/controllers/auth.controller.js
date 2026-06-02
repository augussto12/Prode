import * as authService from '../services/auth.service.js';
import { setTokenCookie, clearTokenCookie } from '../utils/jwt.js';

export async function register(req, res, next) {
  try {
    const { email, username, password, displayName } = req.body;
    const result = await authService.register({ email, username, password, displayName });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function login(req, res, next) {
  try {
    const { login, password } = req.body;
    const result = await authService.login({ login, password });
    
    // Setear cookie HttpOnly con el JWT
    setTokenCookie(res, result.token);
    
    res.json(result);
  } catch (err) { next(err); }
}

export async function verifyEmail(req, res, next) {
  try {
    const result = await authService.verifyEmail(req.body.token);
    setTokenCookie(res, result.token);
    res.json(result);
  } catch (err) { next(err); }
}

export async function resendVerification(req, res, next) {
  try {
    const result = await authService.resendVerification({ email: req.body.email });
    res.json(result);
  } catch (err) { next(err); }
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword({ email: req.body.email });
    res.json(result);
  } catch (err) { next(err); }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword({
      token: req.body.token,
      password: req.body.password,
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function logout(req, res) {
  clearTokenCookie(res);
  res.json({ message: 'Logged out successfully' });
}

export async function getMe(req, res, next) {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.json(profile);
  } catch (err) { next(err); }
}

export async function updateMe(req, res, next) {
  try {
    // req.body ya está sanitizado por Zod (profileUpdateSchema con .strict())
    const updated = await authService.updateProfile(req.user.id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
}

export async function setFavorites(req, res, next) {
  try {
    const { teams } = req.body;
    const favorites = await authService.setFavorites(req.user.id, teams);
    res.json(favorites);
  } catch (err) { next(err); }
}

export async function getFavorites(req, res, next) {
  try {
    const favorites = await authService.getFavorites(req.user.id);
    res.json(favorites);
  } catch (err) { next(err); }
}

export async function getLeagueFavorites(req, res, next) {
  try {
    const favorites = await authService.getLeagueFavorites(req.user.id);
    res.json(favorites.map(f => f.leagueId));
  } catch (err) { next(err); }
}

export async function addLeagueFavorite(req, res, next) {
  try {
    const { leagueId } = req.body;
    const favorite = await authService.addLeagueFavorite(req.user.id, Number(leagueId));
    res.status(201).json(favorite);
  } catch (err) { next(err); }
}

export async function removeLeagueFavorite(req, res, next) {
  try {
    await authService.removeLeagueFavorite(req.user.id, Number(req.params.leagueId));
    res.json({ message: 'Eliminado de favoritos' });
  } catch (err) { next(err); }
}
