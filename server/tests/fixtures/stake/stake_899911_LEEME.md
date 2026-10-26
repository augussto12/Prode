# Stake Argentina – Entrega técnica al agente

Fecha de prueba: 26 de octubre de 2026
Ticket de prueba: `sport:899911`
Identificador UUID (público en enlace compartido): `e3351002-10aa-43bd-812f-751e71d2f637`

## Archivos

1. `stake_899911_graphql_response_original_sanitizada.json`: respuesta **original en estructura y propiedades**, desde Network > Response del navegador, con los 8 outcomes sin normalizar, jerarquías `outcome -> market -> game -> fixture`, identificadores deportivos, valores de líneas y cuotas intactos. No se ha recreado a partir de capturas. Se ha sanitizado el importe apostado y cualquier campo `user` o potencial dato de cuenta; esos campos se sustituyeron por `null`, no son valores reales. La apuesta original tenía datos en `amount`, pero se retiraron deliberadamente. El fixture contiene un ID público que se conserva para pruebas.
2. `stake_betlookup_consulta_minima_probada.graphql`: **consulta exacta, reducida, que se ejecutó con éxito** mediante `fetch` anónimo en Console, sobre `/_api/graphql`. Importante: aquí `fixture` solicita `name` pero **no** `id` (si luego es necesario agrupar por `fixture.id`, agregarlo en una nueva consulta y comprobar que responde).
3. `stake_899911_prueba_navegador.js`: script de la prueba confirmada con `credentials: 'omit'`, `operationName: 'BetLookup'` y `variables: { iid: 'sport:899911' }`. Imprime una tabla de selecciones, no el importe.

## Resultado confirmado

- Endpoint observado: `https://pba.stake.bet.ar/_api/graphql` (POST, GraphQL).
- En el **navegador del mismo dominio**, sin inicio de sesión y con `credentials: 'omit'`, la consulta retornó HTTP 200 y **8** selecciones.
- El tipo anidado es `SwishBet`, no `SportBet`.
- Mercados agrupados en cuatro partidos NBA (dos selecciones por partido); cuota total `27.078583`.
- `status: "confirmed"` refleja una apuesta aceptada, **no** una apuesta ganada.
- El campo `totalOdds` corresponde a una cuota grupal en esta apuesta; no confundir con `odds` individual.

## Estado NO confirmado

- La misma consulta desde Node/Express o desde el VPS Hostinger, sin una sesión del navegador.
- Disponibilidad universal de esta consulta para otros tipos de tickets u otras casas de apuestas.
- Permiso de Stake para consumo/reutilización externa de su API **interna**. Accesibilidad sin login no equivale a autorización para producción. Validar condiciones y consultar al operador antes de desplegar.

## Precauciones

- No utilizar cookies ni cuentas de terceros, ni almacenar credenciales de operadores.
- No divulgar información privada como importes ni identidades de cuentas a personas no autorizadas.
- Para compartir pruebas, enviar solo el cuerpo `query`, `variables` o la respuesta sanitizada. No compartir headers, tokens, cookies ni archivos HAR completos.
- Este JSON contiene un identificador real de apuesta compartida: reemplazar IDs antes de publicar una demo pública.
