import { Router } from 'express';
import type { Pool } from 'pg';
import type { AuthedRequest } from './auth.js';
import { getLatestContextByUserAndRepoName, listReposForUser } from './storage.js';

export function createContextRouter(pool: Pool): Router {
    const router = Router();

    // GET /api/context/:repoName — used by the MCP tool (getRepoContext)
    router.get('/context/:repoName', async (req: AuthedRequest, res) => {
        if (!req.userId) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }

        const repoName = req.params.repoName;
        if (typeof repoName !== 'string' || !repoName.trim()) {
            return res.status(400).json({ error: 'repoName is required' });
        }

        const markdown = await getLatestContextByUserAndRepoName(pool, req.userId, repoName);

        if (!markdown) {
            return res.status(404).json({
                error: `No context found for repo "${repoName}". Has it been pushed yet? Run 'repolens push' from that project.`,
            });
        }

        return res.json({ markdown });
    });

    // GET /api/repos — used by the MCP tool (listRepos), lets the LLM ask "what repos do I have?"
    router.get('/repos', async (req: AuthedRequest, res) => {
        if (!req.userId) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }

        const repos = await listReposForUser(pool, req.userId);
        return res.json({ repos: repos.map((r) => ({ name: r.name, lastPushed: r.last_pushed })) });
    });

    return router;
}