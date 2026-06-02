import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'prode_token';

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function getClearCookieOptions() {
  const { maxAge: _, ...options } = getCookieOptions();
  return options;
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, getCookieOptions());
}

export function clearTokenCookie(res) {
  res.clearCookie(COOKIE_NAME, getClearCookieOptions());
}

export { COOKIE_NAME };
