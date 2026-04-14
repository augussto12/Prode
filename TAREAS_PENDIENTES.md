# 📋 TAREAS PENDIENTES — Prode Mundial 2026

> Última actualización: 14/04/2026, 02:36 AM

---

## 🔥 URGENTE (Hacer primero)

- [ ] **Reiniciar server y probar login** — Se tocaron 10+ archivos de seguridad (JWT ahora va en cookies HttpOnly). Hay que cerrar sesión, volver a loguearse y verificar que todo funcione.
- [ ] **Verificar que el chat siga funcionando** — Socket.io cambió de `auth: { token }` a leer cookies. Probar enviar mensajes.
- [ ] **Verificar predicciones** — Probar que el lockout de 5 minutos antes del partido funcione correctamente.
- [ ] **Verificar grupos** — Probar unirse, salir, banear, desbanear y eliminar grupo.

---

## ⚽ FUNCIONALIDADES PENDIENTES

### API de Fútbol en Vivo
- [ ] Integrar API de fútbol real (football-data.org, API-Football, u otra)
- [ ] Cargar fixtures del Mundial 2026 automáticamente
- [ ] Actualizar resultados en vivo (scores, estadísticas)
- [ ] Cron job o webhook para sincronizar resultados cada X minutos
- [ ] Marcar partidos como LIVE/FINISHED automáticamente

### Push Notifications (Fase 4)
- [ ] Implementar `web-push` en el backend
- [ ] Generar VAPID keys y configurar en `.env`
- [ ] Service Worker: escuchar `push` events
- [ ] Notificar cuando un partido está por empezar (30 min antes)
- [ ] Notificar cuando se publican los resultados de un partido
- [ ] Notificar cuando alguien te supera en la tabla de posiciones

### Gamificación / Badges
- [ ] Diseñar sistema de logros (Ej: "Pitonisa" = 5 resultados exactos seguidos)
- [ ] Modelo `Badge` en Prisma
- [ ] Motor de cálculo de logros (se ejecuta después de calcular puntos)
- [ ] UI de badges en el perfil del usuario
- [ ] Animación de "logro desbloqueado" (toast especial)

### Visitor Mode (futuro)
- [ ] Agregar rol `VISITOR` al enum de Prisma
- [ ] Rutas públicas para ver partidos y resultados sin login
- [ ] Bloquear predicciones y Dream Team para visitors
- [ ] Pantalla de "Registrate para participar" en secciones bloqueadas

---

## 🔧 OPTIMIZACIÓN Y RENDIMIENTO

- [ ] Lazy loading de rutas con `React.lazy()` + `Suspense`
- [ ] `React.memo` en componentes pesados (MatchCard, leaderboard entries)
- [ ] Cacheo de queries frecuentes (partidos, leaderboard) con `stale-while-revalidate`
- [ ] Compresión gzip/brotli en Express (`compression` middleware)
- [ ] Índices adicionales en PostgreSQL si hay queries lentas
- [ ] Optimizar imágenes de jugadores del Dream Team (lazy load + placeholder)

---

## 🧪 TESTING

- [ ] Tests unitarios para `prediction.service.js` (lockout, joker, upsert)
- [ ] Tests unitarios para `scoring.service.js` (cálculo de puntos)
- [ ] Tests de integración para auth flow (register → login → cookie → /me)
- [ ] Tests de integración para group flow (crear → unirse → banear)
- [ ] Test de rate limiter (6 requests rápidos → 429)
- [ ] Test de validación Zod (body malformado → 400)

---

## 🚀 DEPLOY A PRODUCCIÓN

- [ ] Configurar `FRONTEND_URL` en `.env` del server (dominio real)
- [ ] Activar `secure: true` en cookies (requiere HTTPS)
- [ ] Configurar Nginx como reverse proxy
- [ ] Docker Compose para server + client
- [ ] CI/CD básico (GitHub Actions: build → test → deploy)
- [ ] Configurar SSL/TLS (Let's Encrypt)
- [ ] Variables de entorno de producción (JWT_SECRET fuerte, DB remota)
- [ ] Monitoreo básico (health check endpoint, logs)

---

## ✅ COMPLETADO (Referencia)

- [x] Auth completo (register, login, JWT, roles)
- [x] Predicciones globales (1 predicción aplica a todos los grupos)
- [x] Grupos (crear, unirse por código, leaderboard, theming)
- [x] Chat en tiempo real (Socket.io)
- [x] Dream Team (formaciones, pitch visual, reasignación inteligente)
- [x] Admin Panel (resultados, scoring, usuarios, roles, eliminar)
- [x] IA "Gurú Colorado" (Gemini 2.5 Flash)
- [x] PWA instalable (Service Worker, manifest)
- [x] UI Premium (glassmorphism, animations, Framer Motion)
- [x] Toast/Modal global (0 alerts nativos)
- [x] Sistema de ban/unban en grupos
- [x] **Fase 7: Security Hardening completa**
  - [x] Helmet + headers de seguridad
  - [x] CORS restrictivo
  - [x] Rate limiting (global + auth)
  - [x] Zod validation en todos los endpoints
  - [x] Anti-IDOR middleware para grupos
  - [x] JWT en HttpOnly Cookies (anti-XSS)
  - [x] WebSocket seguro (membresía + ban check + sanitización)
  - [x] Bloqueo 5 min antes del partido
  - [x] Theme CSS injection prevention
  - [x] Mass assignment protection (.strict())
