# Prisma migration notes

La base actual no esta baselineada con Prisma Migrate. `prisma migrate status`
detecta una base existente sin historial en `prisma/migrations`.

Para este proyecto, la migracion `20260602010000_add_group_access_control`
es un delta seguro para la base existente:

- crea los enums `GroupJoinPolicy` y `GroupInviteStatus`;
- agrega `Group.joinPolicy` con default `OPEN_WITH_CODE`;
- crea `GroupInvite` para invitaciones/whitelist por username.

La migracion `20260602020000_add_auth_email_tokens` agrega el flujo profesional
de email:

- agrega `User.emailVerifiedAt`;
- marca usuarios existentes como verificados para no bloquear cuentas actuales;
- crea `EmailVerificationToken` y `PasswordResetToken` con tokens hasheados,
  expiracion y borrado en cascada por usuario.

No aplicar migraciones automaticamente contra produccion sin revisar antes el
estado real de la base. Para una migracion completa y reproducible desde cero,
hay que crear un baseline del schema existente y marcarlo como aplicado antes
de usar `prisma migrate deploy` como flujo principal.
