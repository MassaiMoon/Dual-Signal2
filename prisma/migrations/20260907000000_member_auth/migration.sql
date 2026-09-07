-- Member Authentication: MemberAuth, MemberSession, LoginToken
-- ExternalAccount: add requires_review flag

-- MemberAuth: stores verified email, links to User after first Passport mint
CREATE TABLE "member_auths" (
    "id"               TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "user_id"          TEXT,
    "last_login_at"    TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_auths_pkey" PRIMARY KEY ("id")
);

-- MemberSession: active sessions; tokenHash = SHA-256 of raw cookie token
CREATE TABLE "member_sessions" (
    "id"             TEXT NOT NULL,
    "member_auth_id" TEXT NOT NULL,
    "token_hash"     TEXT NOT NULL,
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_sessions_pkey" PRIMARY KEY ("id")
);

-- LoginToken: single-use magic-link tokens (15 min TTL)
CREATE TABLE "login_tokens" (
    "id"             TEXT NOT NULL,
    "member_auth_id" TEXT NOT NULL,
    "token_hash"     TEXT NOT NULL,
    "used"           BOOLEAN NOT NULL DEFAULT false,
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_tokens_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "member_auths_email_key"            ON "member_auths"("email");
CREATE UNIQUE INDEX "member_auths_email_normalized_key" ON "member_auths"("email_normalized");
CREATE UNIQUE INDEX "member_auths_user_id_key"          ON "member_auths"("user_id");
CREATE UNIQUE INDEX "member_sessions_token_hash_key"    ON "member_sessions"("token_hash");
CREATE UNIQUE INDEX "login_tokens_token_hash_key"       ON "login_tokens"("token_hash");

-- Expiry indexes for cleanup
CREATE INDEX "member_sessions_expires_at_idx" ON "member_sessions"("expires_at");
CREATE INDEX "login_tokens_expires_at_idx"    ON "login_tokens"("expires_at");

-- Foreign keys
ALTER TABLE "member_auths"    ADD CONSTRAINT "member_auths_user_id_fkey"
    FOREIGN KEY ("user_id")        REFERENCES "users"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;

ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_member_auth_id_fkey"
    FOREIGN KEY ("member_auth_id") REFERENCES "member_auths"("id")  ON DELETE CASCADE  ON UPDATE CASCADE;

ALTER TABLE "login_tokens"    ADD CONSTRAINT "login_tokens_member_auth_id_fkey"
    FOREIGN KEY ("member_auth_id") REFERENCES "member_auths"("id")  ON DELETE CASCADE  ON UPDATE CASCADE;

-- ExternalAccount: flag for handles that need admin review before use
ALTER TABLE "external_accounts" ADD COLUMN "requires_review" BOOLEAN NOT NULL DEFAULT false;
