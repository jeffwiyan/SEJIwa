import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createDatabase } from '../server/db.mjs';
import { createApiRouter } from '../server/api.mjs';

let app;

function getApiApp() {
  if (app) return app;

  process.env.NODE_ENV ||= 'production';
  const databasePath = path.join(os.tmpdir(), 'sejiwa-vercel.sqlite');
  const db = createDatabase(databasePath);
  app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/api') request.url = '/api/';
    else if (!request.url.startsWith('/api/')) request.url = `/api${request.url}`;
    next();
  });
  app.use(express.json({ limit: '32kb', type: 'application/json' }));
  app.use('/api', createApiRouter(db));
  app.use('/api', (_request, response) => response.status(404).json({ error: 'Endpoint API tidak ditemukan.' }));
  app.use((error, _request, response, _next) => {
    console.error('Vercel API request failed:', error);
    if (!response.headersSent) response.status(500).json({ error: 'Terjadi gangguan pada layanan. Silakan coba kembali.' });
  });
  return app;
}

export default function handler(request, response) {
  return getApiApp()(request, response);
}
