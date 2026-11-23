-- Keep current user_states untouched. Recovery copies are limited to three
-- per account within seven days; future writes additionally space them by 24h.
DELETE FROM user_state_versions
WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days');

DELETE FROM user_state_versions WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY created_at DESC, id DESC
        ) AS version_rank FROM user_state_versions
    ) WHERE version_rank > 3
);

DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
DELETE FROM auth_attempts WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes');
