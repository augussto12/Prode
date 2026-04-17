import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import prisma from './config/database.js';
import { escapeHtml } from './utils/sanitize.js';

const COOKIE_NAME = 'prode_token';

// Throttle: mínimo 1 segundo entre mensajes por socket
const MESSAGE_COOLDOWN_MS = 1000;

export function initSocket(server) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  const io = new Server(server, {
    cors: { 
      origin: allowedOrigins,
      credentials: true, // Necesario para que el browser envíe cookies
    }
  });

  // --- Middleware de autenticación ---
  io.use(async (socket, next) => {
    try {
      let token = null;

      // 1. Intentar leer de cookie (método principal seguro)
      if (socket.handshake.headers.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies[COOKIE_NAME];
      }

      // 2. Fallback: leer de handshake auth (para mobile o clients sin cookies)
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }

      if (!token) return next(new Error('Authentication error'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar que el usuario sigue existiendo en BD
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, displayName: true, role: true, themePrimary: true },
      });

      if (!user) return next(new Error('Authentication error'));

      socket.user = user;
      socket.lastMessageTime = 0; // Inicializar throttle
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    
    // Unirse a la sala del chat del grupo (con validación de membresía)
    socket.on('join_group', async (groupId) => {
      try {
        const parsedId = Number(groupId);
        if (isNaN(parsedId) || parsedId <= 0) return;

        const membership = await prisma.groupUser.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId: parsedId } }
        });
        // Solo permitir si es miembro Y no está baneado
        if (membership && !membership.isBanned) {
          socket.join(`group_${parsedId}`);
        }
      } catch (err) {
        console.error('Socket join_group error:', err.message);
      }
    });

    // Recibir y emitir mensaje (con validación de membresía, throttle y sanitización)
    socket.on('send_message', async (data) => {
      try {
        // --- Throttle: rechazar si envía demasiado rápido ---
        const now = Date.now();
        if (now - socket.lastMessageTime < MESSAGE_COOLDOWN_MS) return;
        socket.lastMessageTime = now;

        const { groupId, content } = data;

        // Validar groupId
        const parsedGroupId = Number(groupId);
        if (isNaN(parsedGroupId) || parsedGroupId <= 0) return;

        // Validar contenido
        if (!content || typeof content !== 'string' || content.trim().length === 0) return;
        
        // Sanitizar: recortar, limitar largo, escapar HTML
        const sanitizedContent = escapeHtml(content.trim().slice(0, 500));

        // VERIFICAR MEMBRESÍA en cada mensaje (no confiar en join_group previo)
        const membership = await prisma.groupUser.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId: parsedGroupId } }
        });
        if (!membership || membership.isBanned) return; // Silenciosamente ignora

        const savedMessage = await prisma.message.create({
          data: { content: sanitizedContent, userId: socket.user.id, groupId: parsedGroupId },
        });

        io.to(`group_${parsedGroupId}`).emit('new_message', {
          id: savedMessage.id,
          content: savedMessage.content,
          createdAt: savedMessage.createdAt,
          user: {
            id: socket.user.id,
            displayName: socket.user.displayName,
            role: socket.user.role,
            themePrimary: socket.user.themePrimary,
          }
        });
      } catch (err) {
        console.error('Socket send_message error:', err.message);
      }
    });

    socket.on('leave_group', (groupId) => {
      const parsedId = Number(groupId);
      if (isNaN(parsedId) || parsedId <= 0) return;
      socket.leave(`group_${parsedId}`);
    });
  });
}
