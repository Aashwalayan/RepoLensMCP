import { Router } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { generateApiKey } from './auth.js';
import type { AuthedRequest } from './auth.js';

/** Public — no auth. This IS how a new user gets their first key. */
export function createSignupRouter(pool: Pool): Router {
  const router = Router();

  // Calling it again with the same email just issues another key for that user
  // (simple for v1; add email verification before charging real money on this).
  router.post('/api/signup', async (req, res) => {
    const { email } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    try {
      let userResult = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);

      let userId: string;
      if (userResult.rows.length === 0) {
        userId = randomUUID();
        await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [userId, email]);
      } else {
        userId = userResult.rows[0].id;
      }

      const { rawKey, keyHash } = generateApiKey();
      await pool.query(
        `INSERT INTO api_keys (id, user_id, key_hash, label) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, keyHash, 'signup']
      );

      // rawKey is shown exactly once — only the hash is stored, so this is the
      // only moment it can ever be retrieved. Tell the user that clearly.
      return res.status(201).json({
        userId,
        apiKey: rawKey,
        message: 'Save this key now — it will not be shown again.',
      });
    } catch (err) {
      console.error('signup failed', err);
      return res.status(500).json({ error: 'Signup failed' });
    }
  });

  return router;
}

/** Authenticated — issue an additional key for an already-existing user (e.g. one for a laptop, one for CI). */
export function createIssueKeyRouter(pool: Pool): Router {
  const router = Router();

  router.post('/keys', async (req: AuthedRequest, res) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const { label } = req.body ?? {};

    try {
      const { rawKey, keyHash } = generateApiKey();
      await pool.query(
        `INSERT INTO api_keys (id, user_id, key_hash, label) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), req.userId, keyHash, typeof label === 'string' ? label : null]
      );

      return res.status(201).json({
        apiKey: rawKey,
        message: 'Save this key now — it will not be shown again.',
      });
    } catch (err) {
      console.error('key creation failed', err);
      return res.status(500).json({ error: 'Failed to create key' });
    }
  });

  return router;
}