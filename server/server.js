import 'dotenv/config'; // Esto asegura que .env cargue ANTES de que se resuelvan los módulos abajo
import { createServer } from 'http';
import app from './src/app.js';
import { initSocket } from './src/socket.js';

const server = createServer(app);
const PORT = process.env.PORT || 5000;

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
