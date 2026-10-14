-- No seeded credentials. Password hashes and sessions are provisioned privately.
CREATE TABLE IF NOT EXISTS admin_accounts (
 account_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 email TEXT NOT NULL UNIQUE CHECK(email=lower(trim(email))),
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin')),
 status TEXT NOT NULL CHECK(status IN ('active','disabled')),
 auth_version INTEGER NOT NULL DEFAULT 1 CHECK(auth_version>=1),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_sha256 TEXT PRIMARY KEY CHECK(length(token_sha256)=64),
 account_id TEXT NOT NULL REFERENCES admin_accounts(account_id) ON DELETE CASCADE,
 auth_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_account ON admin_sessions(account_id);
CREATE TABLE IF NOT EXISTS admin_login_limits (
 key_sha256 TEXT PRIMARY KEY,
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
