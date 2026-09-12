import { Router } from 'express';
import type { Pool } from 'pg';
import { getLatestContextBySlug } from './storage.js';

export function createDownloadRouter(pool: Pool): Router {
  const router = Router();

  router.get('/download/:slug', async (req, res) => {
    const result = await getLatestContextBySlug(pool, req.params.slug);

    if (!result) {
      return res.status(404).json({ error: 'No context found for this repo' });
    }

    // Sanitize: strip anything that isn't safe in a filename across OSes
    const safeName = result.repoName.replace(/[^a-zA-Z0-9._-]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-context.md"`);
    res.type('text/markdown').send(result.markdown);
  });

  return router;
}