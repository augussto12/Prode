import { createServer } from 'http';
import app from './src/app.js';
import dotenv from 'dotenv';
import { initSocket } from './src/socket.js';

dotenv.config();

const server = createServer(app);
const PORT = process.env.PORT || 5000;

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
