import { createHash, randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

export interface AuthedRequest extends Request {
  userId?: string;
  userPlan?: string;
}

function hashKey(rawKey: string): string {
  // API keys are high-entropy already, so a plain SHA-256 is fine —
  // no need for bcrypt-style slow hashing like with user passwords.
  return createHash('sha256').update(rawKey).digest('hex');
}

export function createAuthMiddleware(pool: Pool) {
  return async function requireApiKey(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization; // expects "Bearer <key>"
    const rawKey = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!rawKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    const keyHash = hashKey(rawKey);
    const result = await pool.query(
      `SELECT u.id AS user_id, u.plan
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = $1`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.userId = result.rows[0].user_id;
    req.userPlan = result.rows[0].plan;

    // fire-and-forget — don't block the request on this
    pool.query(`UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1`, [keyHash]).catch(() => {});

    next();
  };
}

/** Generates a new raw API key + its hash, for an issuing/signup endpoint. */
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const rawKey = 'rlk_' + createHash('sha256').update(randomUUID() + Date.now()).digest('hex').slice(0, 32);
  return { rawKey, keyHash: hashKey(rawKey) };
}