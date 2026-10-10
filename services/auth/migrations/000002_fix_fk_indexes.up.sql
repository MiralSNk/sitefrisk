-- Частичные индексы не покрывают каскадное удаление пользователя:
-- в них нет строк с revoked_at IS NOT NULL.
DROP INDEX idx_sessions_user_active;
DROP INDEX idx_api_tokens_user;

CREATE INDEX idx_sessions_user_id   ON sessions (user_id);
CREATE INDEX idx_api_tokens_user_id ON api_tokens (user_id);