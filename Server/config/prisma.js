import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';

import ws from 'ws';
neonConfig.webSocketConstructor = ws;

// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true

// Type definitions
// declare global {
//   var prisma: PrismaClient | undefined
// }

const connectionString = `${process.env.DATABASE_URL}`;

// Opening a new WebSocket connection to Neon costs ~1.5s (TLS + auth over
// several round trips), so keep pooled connections alive between requests
// instead of the driver's short default idle timeout.
const adapter = new PrismaNeon({
  connectionString,
  max: 20,
  idleTimeoutMillis: 5 * 60 * 1000,
});
const prisma = global.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV === 'development') global.prisma = prisma;

export default prisma;