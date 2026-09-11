import { Router } from 'express';
import type { Pool } from 'pg';
import type { AuthedRequest } from './auth.js';
import { saveContext } from './storage.js';

// Rough plan-based ceilings — tune once you know real usage patterns.
const MAX_MARKDOWN_BYTES: Record<string, number> = {
  free: 5_000_000,     // ~500KB
  pro: 5_000_000,    // ~5MB
};

export function createPushRouter(pool: Pool): Router {
  const router = Router();

  router.post('/push', async (req: AuthedRequest, res) => {
    const { repoName, markdown, fileCount, edgeCount } = req.body ?? {};

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (typeof repoName !== 'string' || !repoName.trim()) {
      return res.status(400).json({ error: 'repoName is required' });
    }
    if (typeof markdown !== 'string' || !markdown.trim()) {
      return res.status(400).json({ error: 'markdown is required' });
    }

    const limit = MAX_MARKDOWN_BYTES[req.userPlan ?? 'free'] ?? MAX_MARKDOWN_BYTES.free ?? 500_000;
    const sizeBytes = Buffer.byteLength(markdown, 'utf-8');
    if (sizeBytes > limit) {
      return res.status(413).json({
        error: `Context too large (${sizeBytes} bytes, limit ${limit} for plan "${req.userPlan}")`,
      });
    }

    try {
      const result = await saveContext(pool, req.userId, repoName, markdown, { fileCount, edgeCount });
      return res.status(201).json({
        repoId: result.repoId,
        contextId: result.contextId,
        downloadUrl: `/download/${result.slug}`,
      });
    } catch (err) {
      console.error('push failed', err);
      return res.status(500).json({ error: 'Failed to save context' });
    }
  });

  return router;
}