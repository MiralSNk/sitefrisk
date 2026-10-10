DROP INDEX IF EXISTS idx_api_tokens_user_id;
DROP INDEX IF EXISTS idx_sessions_user_id;

CREATE INDEX idx_sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_tokens_user      ON api_tokens (user_id) WHERE revoked_at IS NULL;