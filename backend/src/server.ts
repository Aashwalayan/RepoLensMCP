import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import { createAuthMiddleware } from './auth.js';
import { createPushRouter } from './pushRoute.js';
import { createDownloadRouter } from './downloadRoute.js';
import { createSignupRouter, createIssueKeyRouter } from './keysRoute.js';
import { createContextRouter } from './contextRoute.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json({ limit: '10mb' })); // markdown payloads can be sizable

const requireApiKey = createAuthMiddleware(pool);

// --- Public routes (no auth) ---
app.use(createSignupRouter(pool));   // POST /api/signup — how a new user gets their first key
app.use(createDownloadRouter(pool)); // GET /download/:slug — slug itself is the access token for v1

// --- Authenticated routes ---
// Scoped to '/api' so requireApiKey doesn't run for /download or /api/signup above.
app.use('/api', requireApiKey, createIssueKeyRouter(pool)); // POST /api/keys — additional keys
app.use('/api', requireApiKey, createPushRouter(pool));      // POST /api/push
app.use('/api', requireApiKey, createContextRouter(pool));   // GET /api/context/:repoName, GET /api/repos

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`RepoLens API listening on :${port}`);
});