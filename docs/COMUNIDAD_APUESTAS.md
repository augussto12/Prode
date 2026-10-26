# Comunidad de apuestas — implementación

26/10/2026. Evolución del Prode existente con React/Vite, Express y Prisma/PostgreSQL.

## Experiencia disponible

- `/inicio`: presentación para visitantes y feed privado para usuarios autenticados.
- `/apuestas`: publicaciones de mis grupos, mis publicaciones y guardados.
- Compartir enlace Stake PBA → vista previa → comentario opcional → publicación en grupo.
- Vista de ticket estructurado cuando el importador devuelve datos válidos; de otro
  modo, publicación explícita de **solo enlace**, nunca mercados inventados.
- Comentarios paginados, eliminación de comentarios propios o por administrador,
  reacción «Me interesa», guardados personales y copiar/abrir enlace original.
- Edición del texto por el autor y eliminación por autor o administrador del grupo.
- Reportes visibles a administradores, sin revelar identidad del denunciante.
- Feed cronológico paginado; filtros por grupo, texto/autor y detalle/solo enlace.
- Grupos nuevos pueden ser comunidades sin torneo o conservar modalidad Prode.
- Pestaña Apuestas en cada grupo; chat existente conservado. Comunidades muestran
  integrantes, sin simular posiciones deportivas.
- Accesos desde perfil a publicaciones propias y guardados.
- Navegación y nombre de la app adaptados a «Prode · Entre amigos».

No se ejecutan apuestas, no se gestionan fondos y no se muestran importes.

## Datos y permisos

`BetTicket` guarda una copia histórica normalizada e inmutable (JSONB con grupos
y selecciones, más cuota Decimal), única por proveedor, host e ID externo.
`BetPost` referencia ese ticket y tiene grupo/autor/texto propios. Las publicaciones
de distintos grupos no comparten comentarios, reacciones ni visibilidad.

`BetImportDraft` guarda una vista previa propia durante 30 minutos y solo permite
publicarla una vez. El cliente no puede enviar snapshots ni cuotas al publicar.
Los borradores vencidos de cada usuario se limpian en su siguiente importación.
`BetComment`, `BetReaction`, `SavedBetPost` y `BetReport` completan el módulo.

Todas las rutas `/api/community` requieren la autenticación existente. Las consultas
y mutaciones verifican membresía activa. Un grupo listado públicamente no hace
públicas sus publicaciones. Los baneados pierden acceso, también a sus guardados.
El módulo limita importaciones (5/minuto/usuario) y escrituras (30/minuto/usuario).
Las mutaciones con Origin solo aceptan el frontend configurado o localhost en desarrollo.

## Estado de Stake

La prueba con el JSON original sanitizado reconstruye 8 selecciones y 4 eventos,
cuota 27.078583. Las dos consultas reales desde Node (query adaptada y query exacta
del navegador del usuario) respondieron HTTP 403.

El adaptador está conectado detrás de `STAKE_PBA_IMPORT_ENABLED=true` en el entorno
del servidor. Por defecto está deshabilitado hasta validar acceso y condiciones
de uso. Sin la opción, o si falla una consulta habilitada, se ofrece solo enlace.
No se reintenta con sesiones, cookies ni evasión de bloqueos. No hay una ruta pública
de demo que use el ticket grabado como si fuera una importación en vivo.

## Base de datos

Migración: `20261026190000_add_bet_community`.
Agrega siete tablas y permite `Group.competitionId = NULL`; conserva datos existentes.
Aplicada de forma transaccional al esquema `prode` de la conexión configurada y
registrada como aplicada en Prisma. Se regeneró Prisma Client.

Había una migración anterior pendiente (`20260609210000_add_prediction_lock_mode`)
sin archivo SQL en su carpeta. No se aplicó ni se marcó como resuelta. Revisar ese
antecedente antes de usar un despliegue global de migraciones en otro entorno.

## Ejecutar localmente

Servidor de preview, desde `server`:

```powershell
node scripts/preview-community.js
```

Escucha en `127.0.0.1:5000`, conserva API y Socket.IO, sin lanzar sincronizaciones
programadas de proveedores. Utiliza el `.env` existente del servidor.

Frontend, desde `client`:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir `http://127.0.0.1:5173/inicio` e ingresar con una cuenta propia existente.

## Verificación realizada

- Validación Prisma y generación del cliente correctas.
- `npm test` del servidor: 76 pruebas aprobadas; la suite de DB es opt-in.
- Suite de integración contra PostgreSQL: 11 pruebas aprobadas. Crea usuarios y
  grupos temporales con IDs propios y los elimina al terminar. Cubre publicación,
  expiración/reuso de borrador, deduplicación de ticket, comentarios, reacciones,
  guardados, reportes, bans, aislamiento entre grupos y autenticación HTTP.
- `npm run build` del cliente: correcto, incluida la PWA.
- `/inicio`, `/apuestas` y `/api/health` responden HTTP 200 a través de Vite.
- No se pudo ejecutar inspección visual: el navegador integrado no está disponible
  y el inventario de aplicaciones de la herramienta devolvió timeout. El build y
  las pruebas de API/DB no sustituyen la revisión visual en escritorio y móvil.

Ejecutar explícitamente la suite de integración, desde `server`:

```powershell
$env:RUN_COMMUNITY_DB_TESTS='true'
try { node --test tests/bet-community.integration.test.js }
finally { Remove-Item Env:RUN_COMMUNITY_DB_TESTS }
```

El servidor de producción no fue desplegado ni reiniciado. Los cambios están en
el checkout y el preview local; la migración de datos sí está aplicada.

## Límites de esta entrega

Importación en vivo de Stake pendiente del 403; prueba en VPS todavía pendiente.
Bet365, estadísticas deportivas automáticas y liquidación de apuestas no se han
implementado. El módulo admite ampliación mediante importadores independientes.
Los filtros por jugador/deporte/mercado y notificaciones quedan para una ampliación;
el feed actual filtra por grupo, autor/texto y disponibilidad del detalle.
