import 'dotenv/config';
import { createServer } from 'node:http';
import app from '../src/app.js';
import { initSocket } from '../src/socket.js';

// Local preview with the existing API/chat, without scheduling background syncs.
const server = createServer(app);
initSocket(server);
server.listen(5000, '127.0.0.1', () => console.log('Prode community preview API: http://127.0.0.1:5000'));
