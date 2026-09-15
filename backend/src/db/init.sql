CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS urls (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    long_url TEXT NOT NULL,
    short_code VARCHAR(20) UNIQUE NOT NULL,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS click_events (
    id SERIAL PRIMARY KEY,
    event_id UUID UNIQUE,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    visitor_hash CHAR(64),
    user_agent TEXT,
    device_type VARCHAR(20),
    country VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE click_events ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS visitor_hash CHAR(64);
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS click_events_event_id_idx ON click_events(event_id);
CREATE INDEX IF NOT EXISTS click_events_url_id_idx ON click_events(url_id);
CREATE INDEX IF NOT EXISTS click_events_created_at_idx ON click_events(created_at);
CREATE INDEX IF NOT EXISTS click_events_url_created_at_idx ON click_events(url_id, created_at);