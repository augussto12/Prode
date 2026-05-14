import 'dotenv/config'; // Esto asegura que .env cargue ANTES de que se resuelvan los módulos abajo
import { createServer } from 'http';
import app from './src/app.js';
import { initSocket } from './src/socket.js';
// [OCULTADO] Cron jobs de Sportmonks y Fantasy — No se usan por ahora
// import { initializeSportmonksJobs } from './src/jobs/index.js';

const server = createServer(app);
const PORT = process.env.PORT || 5000;

const io = initSocket(server);

// [OCULTADO] Cron jobs de Sportmonks y Fantasy — No se usan por ahora
// initializeSportmonksJobs(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});