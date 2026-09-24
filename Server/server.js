import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import 'dotenv/config';
import { clerkMiddleware } from '@clerk/express';

import requireAuth from './middleware/requireAuth.js';
import requireOrg from './middleware/requireOrg.js';
import syncUser from './middleware/syncUser.js';
import errorHandler from './middleware/errorHandler.js';
import prisma from './config/prisma.js';
import { initRealtime } from './realtime.js';

import membersRoutes from './routes/members.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import activityRoutes from './routes/activity.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.get('/', (req, res) => {
  res.send('Server is running Nicely');
});

app.use('/api', requireAuth, requireOrg, syncUser);

app.use('/api/members', membersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Open a few pooled DB connections up front so the first requests (which
  // run some queries in parallel) don't each pay the connection handshake.
  Promise.all(Array.from({ length: 4 }, () => prisma.$queryRaw`SELECT 1`)).catch((err) =>
    console.error('DB warm-up failed:', err.message)
  );
});
