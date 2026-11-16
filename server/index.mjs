import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.mjs';
import { createApiRouter } from './api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = path.resolve(root, '.env.local');
dotenv.config({ path: fs.existsSync(localEnv) ? localEnv : path.resolve(root, '.env') });

if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';

const databasePath = process.env.DATABASE_PATH || './data/sejiwa.sqlite';
const db = createDatabase(
  databasePath === ':memory:' ? databasePath : path.resolve(root, databasePath),
);
const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (request.path.startsWith('/api/')) response.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '32kb', type: 'application/json' }));
app.use('/api', createApiRouter(db));

let vite;
if (process.env.NODE_ENV === 'production') {
  const distDirectory = path.resolve(root, 'dist');
  app.use(express.static(distDirectory, { index: false, maxAge: '1h' }));
  app.get('*', (_request, response) => response.sendFile(path.join(distDirectory, 'index.html')));
} else {
  const { createServer } = await import('vite');
  vite = await createServer({
    root,
    configFile: path.resolve(root, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server: undefined } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`SEJIWA berjalan di http://localhost:${port}`);
  console.log(`SQLite database: ${process.env.DATABASE_PATH || './data/sejiwa.sqlite'}`);
});

function shutdown() {
  server.close(() => {
    vite?.close();
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
