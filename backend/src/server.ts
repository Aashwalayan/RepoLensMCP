import express from 'express';
import { Pool } from 'pg';
import { createAuthMiddleware } from './auth.js';
import { createPushRouter } from './pushRoute.js';
import { createDownloadRouter } from './downloadRoute.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json({ limit: '10mb' })); // markdown payloads can be sizable

const requireApiKey = createAuthMiddleware(pool);

// push requires auth — download does not (slug acts as the access token for v1).
// Scoping requireApiKey to '/api' specifically, so it doesn't run for /download too.
app.use('/api', requireApiKey, createPushRouter(pool));
app.use(createDownloadRouter(pool));

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`RepoLens API listening on :${port}`);
});