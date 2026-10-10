CREATE TYPE message_role AS ENUM ('system', 'user', 'assistant');

-- ========== Реестр версий модели ==========

CREATE TABLE model_versions (
    name        TEXT        PRIMARY KEY,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Проекции данных сканера (приходят из Kafka) ==========

CREATE TABLE scans (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL,
    target_url  TEXT        NOT NULL,
    status      TEXT        NOT NULL,
    finished_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE facts (
    id          BIGSERIAL   PRIMARY KEY,
    scan_id     UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    source_id   BIGINT      NOT NULL,
    type        TEXT        NOT NULL,
    target      TEXT        NOT NULL,
    severity    TEXT        NOT NULL,
    payload     JSONB       NOT NULL DEFAULT '{}',
    detected_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT facts_source_unique UNIQUE (scan_id, source_id)
);

-- ========== Идемпотентность консьюмера ==========

CREATE TABLE processed_events (
    topic        TEXT        NOT NULL,
    partition    INTEGER     NOT NULL,
    kafka_offset BIGINT      NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (topic, partition, kafka_offset)
);

-- ========== Чаты ==========

CREATE TABLE chats (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL,
    title      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Список чатов пользователя, свежие сверху
CREATE INDEX idx_chats_user_updated ON chats (user_id, updated_at DESC);

CREATE TABLE chat_scans (
    chat_id  UUID        NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    scan_id  UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (chat_id, scan_id)
);

CREATE TABLE messages (
    id                BIGSERIAL    PRIMARY KEY,
    chat_id           UUID         NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role              message_role NOT NULL,
    content           TEXT         NOT NULL,
    model_version     TEXT         REFERENCES model_versions(name),
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT messages_model_only_for_assistant CHECK (
        (role = 'assistant' AND model_version IS NOT NULL)
        OR
        (role <> 'assistant' AND model_version IS NULL)
    )
);

-- Загрузка истории чата в хронологическом порядке
CREATE INDEX idx_messages_chat ON messages (chat_id, id);