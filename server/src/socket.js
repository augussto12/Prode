import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import prisma from './config/database.js';

const COOKIE_NAME = 'prode_token';

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
  io.use((socket, next) => {
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
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    
    // Unirse a la sala del chat del grupo (con validación de membresía)
    socket.on('join_group', async (groupId) => {
      try {
        const membership = await prisma.groupUser.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId: Number(groupId) } }
        });
        // Solo permitir si es miembro Y no está baneado
        if (membership && !membership.isBanned) {
          socket.join(`group_${groupId}`);
        }
      } catch (err) {
        console.error('Socket join_group error:', err.message);
      }
    });

    // Recibir y emitir mensaje (con validación de membresía y sanitización)
    socket.on('send_message', async (data) => {
      try {
        const { groupId, content } = data;

        // Validar contenido
        if (!content || typeof content !== 'string' || content.trim().length === 0) return;
        const sanitizedContent = content.trim().slice(0, 500); // Máximo 500 chars

        // VERIFICAR MEMBRESÍA en cada mensaje (no confiar en join_group previo)
        const membership = await prisma.groupUser.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId: Number(groupId) } }
        });
        if (!membership || membership.isBanned) return; // Silenciosamente ignora

        const user = await prisma.user.findUnique({ where: { id: socket.user.id } });
        
        const savedMessage = await prisma.message.create({
          data: { content: sanitizedContent, userId: socket.user.id, groupId: Number(groupId) },
        });

        io.to(`group_${groupId}`).emit('new_message', {
          id: savedMessage.id,
          content: savedMessage.content,
          createdAt: savedMessage.createdAt,
          user: {
            id: user.id,
            displayName: user.displayName,
            role: user.role,
            themePrimary: user.themePrimary
          }
        });
      } catch (err) {
        console.error('Socket send_message error:', err.message);
      }
    });

    socket.on('leave_group', (groupId) => {
      socket.leave(`group_${groupId}`);
    });
  });
}
