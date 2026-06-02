# Runbook Prode grupos

Checklist para dejar lista la version de grupos con codigo, whitelist/invitacion,
predicciones globales por resultado y comodin x2.

## 1. Verificacion rapida

Desde `server`:

```bash
npm test
npx prisma validate
node -e "import('./src/app.js').then(()=>console.log('server import ok')).catch((e)=>{console.error(e); process.exit(1);})"
```

Con el backend levantado:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/ready
```

`/api/health/ready` debe devolver `200` cuando la DB responde y las migraciones
de grupos/auth email ya estan aplicadas. Si devuelve `503`, revisar `checks`.

Desde `client`:

```bash
npm run lint
npm run build
```

`npm run lint` puede mostrar warnings existentes, pero no debe tener errores.

## 2. Migracion de grupos

La base actual no esta baselineada con Prisma Migrate. No usar:

```bash
npx prisma db push --accept-data-loss
```

Para aplicar solo el delta de acceso a grupos:

```bash
cd server
npx prisma db execute --file prisma/migrations/20260602010000_add_group_access_control/migration.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20260602020000_add_auth_email_tokens/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

Antes de aplicarlo en produccion:

- hacer backup de la base;
- revisar que la app este apuntando al schema correcto;
- aplicar el SQL en una ventana controlada;
- reiniciar el backend.
- verificar `GET /api/health/ready`.

## 3. Predicciones y scoring

Regla vigente:

- cada usuario predice solo goles local y visitante;
- si acierta marcador exacto, suma `exactScore`;
- si no es exacto pero acierta ganador o empate, suma `correctWinner`;
- si falla el signo, suma `0`;
- puede marcar `x2` en hasta 3 partidos por competencia;
- el `x2` duplica solo los puntos del resultado.

Los mercados legacy quedan apagados y no participan del calculo.

## 4. Cron Prode

El cron de Prode se inicia desde `server/server.js` cuando arranca el backend real.
No se inicia al importar `src/app.js`, para que tests/imports no creen jobs.

Schedules actuales:

- `01:00`: re-verifica resultados recientes y calcula puntajes;
- `17:00`, `19:00`, `22:00`: calcula puntajes pendientes.

Node-cron usa la zona horaria del servidor. Verificar timezone del host antes de
produccion.

## 5. Prueba manual de grupos

Crear usuarios:

1. Registrar usuario admin.
2. Registrar usuario invitado.
3. Registrar usuario no habilitado.

Flujos:

- Crear grupo con `Codigo abierto`.
- Unirse con codigo como invitado.
- Cambiar entrada a `Whitelist + codigo`.
- Agregar username del invitado a `Invitados`.
- Probar que el invitado habilitado entra con codigo.
- Probar que el usuario no habilitado no entra.
- Cambiar entrada a `Solo invitacion de un uso`.
- Agregar username, entrar una vez, volver a intentar entrar con otra cuenta o luego de revocar.
- Banear, desbanear, salir y eliminar grupo.

## 6. Prueba manual de prode

1. Entrar a `Mi Prode`.
2. Cargar resultado de un partido futuro.
3. Marcar `x2` en hasta 3 partidos.
4. Intentar marcar un cuarto `x2`; debe rechazarlo.
5. Ver historial: debe mostrar solo resultado y etiqueta `x2`.
6. Ver predicciones de grupo despues de partido finalizado.
7. Ejecutar recalculo manual desde admin o esperar cron.
8. Verificar leaderboard del grupo.

## 7. Pendientes antes de produccion

- Aplicar la migracion SQL de acceso a grupos.
- Aplicar la migracion SQL de auth por email.
- Configurar `FRONTEND_URL` real.
- Configurar Mailgun:
  - `MAILGUN_API_KEY`;
  - `MAILGUN_DOMAIN=mail.prodearg.com`;
  - `MAILGUN_FROM="Prode Mundial <no-reply@mail.prodearg.com>"`;
  - `MAILGUN_REGION=US`.
- No poner claves reales en `.env.example` ni en archivos versionados. Si una key
  real queda escrita por error, rotarla en Mailgun.
- Confirmar `NODE_ENV=production` y cookies seguras detras de HTTPS.
- Confirmar timezone del servidor.
- Confirmar que la API de futbol responda fixtures/resultados.
- Hacer prueba real de registro, verificacion de email, olvide mi contrasena,
  login, chat, grupos, predicciones y leaderboard.
