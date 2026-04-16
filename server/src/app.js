import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import matchRoutes from './routes/match.routes.js';
import predictionRoutes from './routes/prediction.routes.js';
import groupRoutes from './routes/group.routes.js';
import adminRoutes from './routes/admin.routes.js';
import dreamteamRoutes from './routes/dreamteam.routes.js';
import outrightsRoutes from './routes/outrights.routes.js';
import guruRoutes from './routes/guru.routes.js';
import syncRoutes from './routes/sync.routes.js';
import competitionRoutes from './routes/competition.routes.js';
import explorerRoutes from './routes/explorer.routes.js';

const app = express();

// --- CAPA 1: MIDDLEWARE DE BLINDAJE ---

// Confiar en el proxy (vital si usás Docker/Nginx, evita el error ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

// Headers de seguridad (CSP, X-Frame-Options, HSTS, etc.)
app.use(helmet());

// CORS restrictivo — solo nuestro frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, Postman en dev)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Necesario para cookies HttpOnly
}));

// Cookie parser para leer JWT desde cookies
app.use(cookieParser());

// Body parser con límite de 1MB (anti payload bombing)
app.use(express.json({ limit: '1mb' }));

// Rate limiter global: 100 requests por minuto por IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Esperá un momento.' },
});
app.use(globalLimiter);

// Rate limiter estricto para auth: 5 intentos por minuto
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login. Esperá 1 minuto.' },
});

// --- RUTAS ---
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dreamteam', dreamteamRoutes);
app.use('/api/outrights', outrightsRoutes);
app.use('/api/guru', guruRoutes);
app.use('/api/admin/sync', syncRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/explorer', explorerRoutes);

// Error handler centralizado
app.use(errorHandler);

export default app;
