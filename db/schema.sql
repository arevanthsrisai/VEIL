-- VEIL - database schema (Voroa Postgres, PostgreSQL 17)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT NOT NULL, password_hash TEXT NOT NULL, nickname TEXT, avatar_emoji TEXT DEFAULT '🎭', role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','MODERATOR','ADMIN')), restricted_until TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS confessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT CHECK (title IS NULL OR length(title) <= 120), content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 5000), status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ, rejection_reason TEXT);
CREATE INDEX IF NOT EXISTS confessions_status_created_idx ON confessions (status, created_at);
CREATE INDEX IF NOT EXISTS confessions_author_idx ON confessions (author_id, created_at);
CREATE TABLE IF NOT EXISTS reactions (confession_id UUID NOT NULL REFERENCES confessions(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (confession_id, user_id, emoji));
CREATE TABLE IF NOT EXISTS reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), confession_id UUID REFERENCES confessions(id) ON DELETE CASCADE, reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500), status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_by UUID REFERENCES users(id));
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at);
CREATE TABLE IF NOT EXISTS moderation_actions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), moderator_id UUID NOT NULL REFERENCES users(id), action TEXT NOT NULL CHECK (action IN ('APPROVED','REJECTED')), target_type TEXT NOT NULL CHECK (target_type IN ('confession')), target_id UUID NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, confession_id UUID REFERENCES confessions(id) ON DELETE CASCADE, read BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at);

CREATE TABLE IF NOT EXISTS bookmarks (user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, confession_id UUID NOT NULL REFERENCES confessions(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, confession_id));
CREATE TABLE IF NOT EXISTS polls (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), question TEXT NOT NULL CHECK (length(question) BETWEEN 1 AND 500), options JSONB NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED')), ends_at TIMESTAMPTZ, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS poll_votes (poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, option_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (poll_id, user_id));
CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES users(id));
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id UUID NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, meta JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON bookmarks (user_id, created_at);
CREATE INDEX IF NOT EXISTS polls_status_idx ON polls (status, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at);
