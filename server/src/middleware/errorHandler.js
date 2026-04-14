export function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  const status = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
