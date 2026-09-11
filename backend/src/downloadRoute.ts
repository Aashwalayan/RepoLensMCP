import { Router } from 'express';
import type { Pool } from 'pg';
import { getLatestContextBySlug } from './storage.js';

export function createDownloadRouter(pool: Pool): Router {
  const router = Router();

  router.get('/download/:slug', async (req, res) => {
    const markdown = await getLatestContextBySlug(pool, req.params.slug);

    if (!markdown) {
      return res.status(404).json({ error: 'No context found for this repo' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="repo-context.md"`);
    res.type('text/markdown').send(markdown);
  });

  return router;
}