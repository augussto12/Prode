# Importador Stake PBA: implementación y estado de la prueba

Fecha: 26/10/2026. Este documento registra la prueba del importador Node y CLI.
La evolución posterior con UI, API, Prisma y grupos está documentada en
`COMUNIDAD_APUESTAS.md`. El acceso automático a Stake sigue pendiente de validación.

## Resultado real

Se ejecutó una consulta desde Node v24.13.0 en el equipo de desarrollo Windows,
fuera del navegador, para el enlace del ticket `sport:899911` del relevamiento.
Se utilizó `POST https://pba.stake.bet.ar/_api/graphql`, sin cookies ni autorización.

Resultado: **HTTP 403**, `state: not_accessible`, `code: ACCESS_DENIED`.
No se obtuvieron mercados. No se siguieron redirecciones ni se hicieron reintentos.
No se persistió ni imprimió el cuerpo de error del proveedor.

Tras recibir `stake_899911_original_sanitizada_y_consulta.zip`, se hizo una
segunda prueba acotada con la **consulta exacta del usuario**, leída sin cambios
del archivo `.graphql`. También devolvió **HTTP 403**, con respuesta no JSON,
sin cookies ni redirecciones. Se canceló el cuerpo sin imprimirlo ni guardarlo.
El bloqueo se reproduce incluso sin agregar `fixture.id` ni retirar campos.

Ese resultado no determina si la causa es la IP, la infraestructura, el entorno
de ejecución u otra restricción del proveedor. Tampoco demuestra que Hostinger
vaya a funcionar o fallar. El contrato GraphQL ampliado sigue sin validarse en vivo.

## Qué está implementado

- Registro de importadores con contrato común documentado en JSDoc.
- `StakeArgentinaImporter`: validación de HTTPS, host exacto, ruta deportiva,
  UUID e IID; rechazo de parámetros de identidad repetidos y credenciales en URL.
- Endpoint y query fijos; solo se envía el IID como variable. La URL del usuario
  nunca se usa como destino HTTP. Sin cookies, tokens, redirects ni retries.
- Timeout de 12 segundos que cubre lectura del cuerpo; límite de respuesta de 1 MiB.
- Verificación cruzada de UUID e IID devueltos.
- Normalización de `SwishBet` con selecciones over/under de jugadores,
  agrupación por fixture ID y validación de cuota consistente dentro de cada grupo.
- Cuotas y líneas como strings decimales; se conserva el total del proveedor,
  sin calcularlo multiplicando precios individuales.
- Errores explícitos ante bloqueos, 429, timeout, tipo no soportado, errores
  GraphQL, respuesta parcial o inconsistente. Un error nunca incluye un ticket listo.
- No se solicitan importes, moneda ni cuenta. La salida usa campos permitidos
  explícitos, incluso si el proveedor devuelve datos extra.
- Ticket independiente de publicación/grupo. Futura identidad persistida:
  `(provider, host, ticketUuid)`; múltiples publicaciones podrán referenciarlo.

La consulta de `src/services/bet-imports/stake-query.js` deriva de la sección 5.2
del relevamiento. Agrega `fixture.id` y omite `amount/currency` por minimización.
**No se presenta como la consulta exacta ya probada por el usuario.**
Se comparó con la consulta exacta recibida en el segundo ZIP: coincide en la
selección de campos salvo esas diferencias. La respuesta completa de Network
sí incluye los IDs de fixture y es compatible con el parser actual.

## Ejecutar la prueba

Desde `server`, con Node que soporte fetch nativo (probado con v24.13.0):

```powershell
node scripts/probe-stake-import.js 'https://pba.stake.bet.ar/sports/home?betId=e3351002-10aa-43bd-812f-751e71d2f637&source=link_shared&modal=bet&iid=sport%3A899911' --expect-sample
```

`--expect-sample` exige el UUID/IID esperado, 8 selecciones, 4 eventos y cuota
27.078583 para dar éxito. Sin esa opción se aceptan otros tickets compatibles.
`--json` imprime el objeto normalizado completo, incluidos identificadores y
enlace compartido, pero nunca importe o cuenta. La salida predeterminada muestra
solo resumen y estado. Salida del proceso: 0 éxito, 1 uso incorrecto, 2 fallo
de importación o discordancia con el ejemplo. El script no carga `.env` ni usa DB.

## Validación local y límites

```powershell
node --test tests/stake-importer.test.js
node --test tests/stake-importer.contract.test.js
npm test
```

Los 41 tests iniciales usan una respuesta de transporte **sintética** para
comprobar parser, privacidad, límites y errores. Se agregaron **3 pruebas de
contrato offline** con el JSON original sanitizado, extraído sin modificar del
segundo ZIP. Verifican todas las selecciones, IDs, agrupación, cuotas, salida
sin datos privados y funcionamiento con los campos mínimos requeridos.

La consulta mínima histórica no solicita IDs de fixture: si faltan, el parser
devuelve `partial`, sin agrupar por nombres ni inventar IDs. Esta conducta también
está cubierta por la prueba de contrato. La evidencia original y su hash están
en `server/tests/fixtures/stake/README.md`.

Las pruebas con el archivo original validan el parser para el caso observado;
no sustituyen una consulta exitosa desde Node al proveedor.

Resultado de `npm test` en esta revisión: **76 tests aprobados**, incluidos
**44 del importador**. No hubo fallos en las pruebas existentes del backend.

`ready` significa que todos los elementos recibidos pasan las validaciones
de este adaptador. No podemos detectar selecciones omitidas silenciosamente por
el proveedor sin una fuente independiente del total. El caso conocido se verifica
con `--expect-sample`. Otros tipos de apuesta y direcciones se rechazan hasta
contar con evidencia de su estructura y semántica.

## Pendiente para validar la integración

1. Repetir la consulta acotada desde el VPS, cuando esté disponible su acceso.
   Ante otro bloqueo, investigar con el proveedor, sin eludir restricciones.
2. Confirmar autorización y condiciones del proveedor para uso externo, según el relevamiento.
3. Probar tickets adicionales y estados posteriores a liquidación.
4. Tras esa validación, conectar el módulo a una ruta autenticada con límites de
   consultas, Prisma, publicaciones y permisos de grupo. El diseño actual sigue intacto.
