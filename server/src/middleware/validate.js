/**
 * Middleware de validación genérico con Zod.
 * Uso: router.post('/endpoint', validate(miSchema), controller)
 * 
 * Parsea y sanitiza req.body. Si falla, devuelve 400 con el primer error.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue.message,
        field: firstIssue.path.join('.'),
      });
    }
    // Reemplazar body con datos parseados y sanitizados
    req.body = result.data;
    next();
  };
}
