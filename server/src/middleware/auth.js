import { verifyToken, COOKIE_NAME } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import prisma from '../config/database.js';

export async function authenticate(req, res, next) {
  try {
    // 1. Intentar leer de cookie HttpOnly (método seguro principal)
    let token = req.cookies?.[COOKIE_NAME];

    // 2. Fallback: leer de Authorization header (para compatibilidad con mobile/Postman)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, username: true, displayName: true, role: true, avatar: true }
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(error);
  }
}
