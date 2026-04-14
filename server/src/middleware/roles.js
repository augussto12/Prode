import { ForbiddenError } from '../utils/errors.js';

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Autenticación requerida'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Requiere rol: ${roles.join(' o ')}`));
    }
    next();
  };
}

export const isAdmin = requireRole('ADMIN', 'SUPERADMIN');
export const isSuperAdmin = requireRole('SUPERADMIN');
