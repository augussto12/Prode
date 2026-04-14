import prisma from '../config/database.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

/**
 * Middleware Anti-IDOR: verifica que el usuario autenticado sea miembro activo 
 * del grupo indicado en req.params.id. Bloquea si no pertenece o está baneado.
 */
export async function requireGroupMember(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    if (isNaN(groupId)) {
      throw new NotFoundError('ID de grupo inválido');
    }

    const membership = await prisma.groupUser.findUnique({
      where: { userId_groupId: { userId: req.user.id, groupId } },
    });

    if (!membership) {
      throw new ForbiddenError('No eres miembro de este grupo');
    }

    if (membership.isBanned) {
      throw new ForbiddenError('Fuiste baneado de este grupo');
    }

    // Adjuntar membresía al request para uso posterior
    req.groupMembership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Variante que requiere ser admin del grupo.
 */
export async function requireGroupAdmin(req, res, next) {
  try {
    const groupId = Number(req.params.id);
    if (isNaN(groupId)) {
      throw new NotFoundError('ID de grupo inválido');
    }

    const membership = await prisma.groupUser.findUnique({
      where: { userId_groupId: { userId: req.user.id, groupId } },
    });

    if (!membership || !membership.isAdmin) {
      throw new ForbiddenError('Solo los administradores del grupo pueden hacer esto');
    }

    req.groupMembership = membership;
    next();
  } catch (err) {
    next(err);
  }
}
