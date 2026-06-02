import 'dotenv/config';
import { createServer } from 'http';
import app from './src/app.js';
import { initSocket } from './src/socket.js';
import { setupCronJobs } from './src/cron/scheduledTasks.js';

const server = createServer(app);
const PORT = process.env.PORT || 5000;

initSocket(server);

setupCronJobs();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
