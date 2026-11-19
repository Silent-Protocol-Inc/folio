CREATE TABLE folio_accounts (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 must_change INTEGER NOT NULL DEFAULT 1,
 auth_epoch INTEGER NOT NULL DEFAULT 0,
 workspace TEXT,
 revision INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE folio_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL REFERENCES folio_accounts(id) ON DELETE CASCADE,
 auth_epoch INTEGER NOT NULL,
 expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX folio_sessions_account ON folio_sessions(account_id);
--> statement-breakpoint
CREATE TABLE folio_passkeys (
 credential_id TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL REFERENCES folio_accounts(id) ON DELETE CASCADE,
 public_key TEXT NOT NULL,
 counter INTEGER NOT NULL,
 transports TEXT NOT NULL,
 name TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 used_at INTEGER
);
--> statement-breakpoint
CREATE INDEX folio_passkeys_account ON folio_passkeys(account_id);
--> statement-breakpoint
CREATE TABLE folio_challenges (
 id TEXT PRIMARY KEY NOT NULL,
 challenge TEXT NOT NULL,
 account_id TEXT NOT NULL,
 session_hash TEXT,
 purpose TEXT NOT NULL,
 expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE folio_auth_limits (
 rate_key TEXT PRIMARY KEY NOT NULL,
 slot INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
