CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL,
    email_lower   TEXT        GENERATED ALWAYS AS (lower(email)) STORED,
    password_hash TEXT        NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT users_email_has_at    CHECK (position('@' in email) > 1)
);

-- Логин: WHERE email_lower = lower($1)
CREATE UNIQUE INDEX users_email_lower_key ON users (email_lower);

CREATE TABLE sessions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_hash TEXT        NOT NULL,
    user_agent   TEXT,
    ip           INET,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,

    CONSTRAINT sessions_refresh_hash_key UNIQUE (refresh_hash),
    CONSTRAINT sessions_expires_after_created CHECK (expires_at > created_at)
);

-- Активные сессии пользователя: список устройств, выход со всех
CREATE INDEX idx_sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;

-- Чистка просроченных: WHERE expires_at < now()
CREATE INDEX idx_sessions_expired ON sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE api_tokens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    token_hash   TEXT        NOT NULL,
    token_prefix TEXT        NOT NULL,
    scopes       TEXT[]      NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,

    CONSTRAINT api_tokens_hash_key UNIQUE (token_hash)
);

-- Список токенов пользователя в интерфейсе
CREATE INDEX idx_api_tokens_user ON api_tokens (user_id) WHERE revoked_at IS NULL;

CREATE TABLE outbox (
    id           BIGSERIAL   PRIMARY KEY,
    aggregate_id TEXT        NOT NULL,
    event_type   TEXT        NOT NULL,
    payload      JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unpublished ON outbox (id) WHERE published_at IS NULL;