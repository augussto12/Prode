# Evidencia de Stake aportada por el usuario

Origen: `stake_899911_original_sanitizada_y_consulta.zip`, recibido el 26/10/2026.
Los tres archivos `stake_*` se extrajeron sin modificaciones del ZIP:

- Respuesta de Network original sanitizada, no reconstruida del ejemplo normalizado.
- Consulta mínima exacta probada en el navegador por el usuario.
- LEEME original que explica procedencia, alcance y sanitización.

SHA-256 de `stake_899911_graphql_response_original_sanitizada.json`:
`eb3e8298a1a8a10bdb7cd7706d1feb61c2900217df9f115ddf72ebfef84c9f56`.

La respuesta completa de Network y la consulta mínima son evidencias diferentes:
la respuesta contiene fixture IDs y muchos campos que la consulta mínima no pide.
La prueba de contrato valida el parser contra esa respuesta grabada; no demuestra
disponibilidad del endpoint desde Node/VPS ni que la consulta ampliada responda hoy.

Importe, importe activo, pago y usuario están en null. Se mantienen IDs reales
del ticket compartido y entidades deportivas. Uso exclusivo como fixture de
desarrollo; no incluir estos archivos en bundles ni demos públicas.

La consulta histórica pide importe/moneda. Se conserva como evidencia, pero el
importador utiliza su propia query que los omite y solicita `fixture.id`.
