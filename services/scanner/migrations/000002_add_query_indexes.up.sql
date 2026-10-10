-- Список сканов пользователя: WHERE user_id + ORDER BY created_at DESC --
CREATE INDEX idx_scans_user_created ON scans (user_id, created_at DESC);

-- Лента событий скана: WHERE scan_id + хронологический порядок по id
CREATE INDEX idx_scans_events_scan ON scan_events (scan_id, id);