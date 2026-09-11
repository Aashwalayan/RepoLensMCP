-- users: one row per account
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | etc — drives rate limits
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- api_keys: a user can have multiple (e.g. one per machine/CI)
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash      TEXT UNIQUE NOT NULL,            -- store a hash, never the raw key
  label         TEXT,                             -- e.g. "laptop", "CI"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

-- repos: one row per repo a user has pushed from
CREATE TABLE repos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                    -- user-facing repo identifier, e.g. "RepoLensMCP"
  slug          TEXT UNIQUE NOT NULL,              -- URL-safe, used in download links
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- contexts: the actual generated markdown, versioned (append-only)
CREATE TABLE contexts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  markdown      TEXT NOT NULL,
  file_count    INT,
  edge_count    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fast lookup of "latest context for this repo"
CREATE INDEX idx_contexts_repo_latest ON contexts (repo_id, created_at DESC);