-- FK chat_scans.scan_id -> scans(id) ON DELETE CASCADE без индекса.
-- Он же обслуживает запрос «в каких чатах обсуждается этот скан».
CREATE INDEX idx_chat_scans_scan ON chat_scans (scan_id);