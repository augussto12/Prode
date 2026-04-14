import * as authService from '../services/auth.service.js';
import { setTokenCookie, clearTokenCookie } from '../utils/jwt.js';

export async function register(req, res, next) {
  try {
    const { email, username, password, displayName } = req.body;
    const result = await authService.register({ email, username, password, displayName });
    
    // Setear cookie HttpOnly con el JWT
    setTokenCookie(res, result.token);
    
    // Devolver user + token (el token en body es para backward compat, el frontend puede ignorarlo)
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
