import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'prode_token';

const cookieOptions = {
  httpOnly: true,      // ← No accesible desde JavaScript (anti-XSS)
  secure: process.env.NODE_ENV === 'production', // HTTPS only en producción
  sameSite: 'lax',     // Protección CSRF básica (strict rompe OAuth flows futuros)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en ms
  path: '/',
};

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Setea el JWT como cookie HttpOnly en la respuesta.
 */
export function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

/**
 * Limpia la cookie del token (logout).
 */
export function clearTokenCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export { COOKIE_NAME };
