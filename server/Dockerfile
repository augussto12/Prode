# ═══════════════════════════════════════════════
# Backend — Node.js + Prisma + Socket.io
# ═══════════════════════════════════════════════
FROM node:20-alpine

WORKDIR /app

# Copiar package files e instalar deps
COPY package*.json ./
RUN npm ci

# Copiar prisma schema y generar client
COPY prisma ./prisma
RUN npx prisma generate

# Copiar código fuente
COPY . .

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/auth || exit 1

CMD ["node", "server.js"]
