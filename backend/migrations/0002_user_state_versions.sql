CREATE TABLE IF NOT EXISTS user_state_versions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    state_updated_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_state_versions_user_created_at
    ON user_state_versions (user_id, created_at);
