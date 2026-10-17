-- LinkForge database schema.
-- Safe to run repeatedly: existing tables and records are preserved.

BEGIN;

-- Accounts that own shortened URLs.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Short links created by users. A NULL expires_at means the link does not expire.
CREATE TABLE IF NOT EXISTS urls (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    long_url TEXT NOT NULL,
    short_code VARCHAR(20) NOT NULL UNIQUE,
    click_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- One row per recorded redirect. Analytics are written asynchronously by the worker.
CREATE TABLE IF NOT EXISTS click_events (
    id SERIAL PRIMARY KEY,
    event_id UUID,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    visitor_hash CHAR(64),
    user_agent TEXT,
    device_type VARCHAR(20),
    country VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bring forward click_events tables created before event deduplication and visitor/device
-- analytics were added. These additions preserve existing event rows.
ALTER TABLE click_events
    ADD COLUMN IF NOT EXISTS event_id UUID,
    ADD COLUMN IF NOT EXISTS visitor_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);

-- event_id is nullable for older rows, but new queued events have a unique ID.
CREATE UNIQUE INDEX IF NOT EXISTS click_events_event_id_idx
    ON click_events (event_id);

-- Support the queries used to list links and build click analytics.
CREATE INDEX IF NOT EXISTS urls_user_id_created_at_idx
    ON urls (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS click_events_url_id_idx
    ON click_events (url_id);

CREATE INDEX IF NOT EXISTS click_events_created_at_idx
    ON click_events (created_at);

CREATE INDEX IF NOT EXISTS click_events_url_created_at_idx
    ON click_events (url_id, created_at);

COMMIT;
