import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export interface PushResult {
  repoId: string;
  contextId: string;
  slug: string;
}

/** Finds or creates the repo row for this user, then stores a new context version. */
export async function saveContext(
  pool: Pool,
  userId: string,
  repoName: string,
  markdown: string,
  meta: { fileCount?: number; edgeCount?: number } = {}
): Promise<PushResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let repoResult = await client.query(
      `SELECT id, slug FROM repos WHERE user_id = $1 AND name = $2`,
      [userId, repoName]
    );

    let repoId: string;
    let slug: string;

    if (repoResult.rows.length === 0) {
      repoId = randomUUID();
      slug = `${slugify(repoName)}-${repoId.slice(0, 8)}`; // suffix avoids slug collisions
      await client.query(
        `INSERT INTO repos (id, user_id, name, slug) VALUES ($1, $2, $3, $4)`,
        [repoId, userId, repoName, slug]
      );
    } else {
      repoId = repoResult.rows[0].id;
      slug = repoResult.rows[0].slug;
    }

    const contextId = randomUUID();
    await client.query(
      `INSERT INTO contexts (id, repo_id, markdown, file_count, edge_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [contextId, repoId, markdown, meta.fileCount ?? null, meta.edgeCount ?? null]
    );

    await client.query('COMMIT');
    return { repoId, contextId, slug };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Latest context for a repo, by repo id — used by the MCP tool. */
export async function getLatestContextByRepoId(pool: Pool, repoId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT markdown FROM contexts WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [repoId]
  );
  return result.rows[0]?.markdown ?? null;
}

/** Latest context by slug — used by the public download route. Returns the repo's real name too, for the download filename. */
export async function getLatestContextBySlug(
  pool: Pool,
  slug: string
): Promise<{ markdown: string; repoName: string } | null> {
  const result = await pool.query(
    `SELECT c.markdown, r.name AS repo_name
     FROM contexts c
     JOIN repos r ON r.id = c.repo_id
     WHERE r.slug = $1
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  return { markdown: result.rows[0].markdown, repoName: result.rows[0].repo_name };
}

/** All repos for a user, with their latest push time — for an MCP "list repos" tool or dashboard. */
export async function listReposForUser(pool: Pool, userId: string) {
  const result = await pool.query(
    `SELECT r.id, r.name, r.slug, MAX(c.created_at) AS last_pushed
     FROM repos r
     LEFT JOIN contexts c ON c.repo_id = r.id
     WHERE r.user_id = $1
     GROUP BY r.id
     ORDER BY last_pushed DESC NULLS LAST`,
    [userId]
  );
  return result.rows;
}

/** Latest context for one of THIS user's repos, by name — used by the MCP tool (authenticated, so scoped to their own repos). */
export async function getLatestContextByUserAndRepoName(
  pool: Pool,
  userId: string,
  repoName: string
): Promise<string | null> {
  const result = await pool.query(
    `SELECT c.markdown
     FROM contexts c
     JOIN repos r ON r.id = c.repo_id
     WHERE r.user_id = $1 AND r.name = $2
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [userId, repoName]
  );
  return result.rows[0]?.markdown ?? null;
}