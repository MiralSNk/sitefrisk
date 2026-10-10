CREATE TYPE scan_status AS ENUM ('pending', 'running', 'done', 'failed');
CREATE TYPE severity    AS ENUM ('info', 'low', 'medium', 'high', 'critical');

CREATE TABLE scans (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL,
    target_url    TEXT        NOT NULL,
    status        scan_status NOT NULL DEFAULT 'pending',
    current_stage TEXT,
    progress      SMALLINT    NOT NULL DEFAULT 0,
    facts_count   INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,

    CONSTRAINT scans_progress_range CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT scans_facts_count_positive CHECK (facts_count >= 0),
    CONSTRAINT scans_time_order CHECK (
        finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
    )
);

CREATE TABLE facts (
    id          BIGSERIAL   PRIMARY KEY,
    scan_id     UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL,
    target      TEXT        NOT NULL,
    severity    severity    NOT NULL,
    payload     JSONB       NOT NULL DEFAULT '{}',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT facts_unique_per_scan UNIQUE (scan_id, type, target)
);

CREATE TABLE scan_events (
    id         BIGSERIAL   PRIMARY KEY,
    scan_id    UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    stage      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    payload    JSONB       NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
    id           BIGSERIAL   PRIMARY KEY,
    aggregate_id TEXT        NOT NULL,
    event_type   TEXT        NOT NULL,
    payload      JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unpublished ON outbox (id) WHERE published_at IS NULL;