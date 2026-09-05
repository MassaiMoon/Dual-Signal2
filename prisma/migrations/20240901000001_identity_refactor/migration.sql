-- Identity Refactor migration
-- Transforms DUAL // SIGNAL from wallet-oriented to privacy-first community identity.
-- All statements are idempotent: safe to run against new or existing databases.

-- ── 1. Add username identity to users ────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username"            TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username_normalized" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key"
    ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_normalized_key"
    ON "users"("username_normalized");

-- ── 2. Add DUAL_FORUM to EventSource enum ────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE "EventSource" ADD VALUE IF NOT EXISTS 'DUAL_FORUM';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Create Provider enum (separate from EventSource) ───────────────────────
DO $$ BEGIN
  CREATE TYPE "Provider" AS ENUM ('TWITTER','TELEGRAM','DISCORD','DUAL_FORUM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Rename badge columns (old → new) ──────────────────────────────────────

-- x_signal_impressions → x_signal_public_views
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'x_signal_impressions'
  ) THEN
    ALTER TABLE "badges" RENAME COLUMN "x_signal_impressions" TO "x_signal_public_views";
  END IF;
END $$;

-- holder_level → discord_level
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'holder_level'
  ) THEN
    ALTER TABLE "badges" RENAME COLUMN "holder_level" TO "discord_level";
  END IF;
END $$;

-- holder_qual_days → discord_active_days
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'holder_qual_days'
  ) THEN
    ALTER TABLE "badges" RENAME COLUMN "holder_qual_days" TO "discord_active_days";
  END IF;
END $$;

-- ── 5. Add new badge columns ──────────────────────────────────────────────────
ALTER TABLE "badges" ADD COLUMN IF NOT EXISTS "x_qualifying_posts" INTEGER NOT NULL DEFAULT 0;

-- ── 6. Change external_accounts.source from EventSource → Provider ───────────
-- Remove MOCK rows that cannot be cast to Provider before type conversion
DELETE FROM "external_accounts"
WHERE "source"::text NOT IN ('TWITTER','TELEGRAM','DISCORD','DUAL_FORUM');

DO $$
BEGIN
  -- Only attempt if column is still of EventSource type
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_type t  ON t.oid = a.atttypid
    WHERE c.relname = 'external_accounts'
    AND a.attname   = 'source'
    AND t.typname   = 'EventSource'
  ) THEN
    -- Drop the unique index before altering the column type
    DROP INDEX IF EXISTS "external_accounts_source_external_user_id_key";

    ALTER TABLE "external_accounts"
      ALTER COLUMN "source" TYPE "Provider"
      USING "source"::text::"Provider";
  END IF;
END $$;

-- Recreate index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "external_accounts_source_external_user_id_key"
    ON "external_accounts"("source", "external_user_id");

-- ── 7. Evidence table: x_posts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "x_posts" (
    "id"           TEXT NOT NULL,
    "badge_id"     TEXT NOT NULL,
    "post_id"      TEXT NOT NULL,
    "public_views" BIGINT NOT NULL DEFAULT 0,
    "posted_at"    TIMESTAMP(3) NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "x_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "x_posts_badge_id_post_id_key"
    ON "x_posts"("badge_id", "post_id");
DO $$ BEGIN
  ALTER TABLE "x_posts" ADD CONSTRAINT "x_posts_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. Evidence table: telegram_active_days ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "telegram_active_days" (
    "id"         TEXT NOT NULL,
    "badge_id"   TEXT NOT NULL,
    "day"        DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_active_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_active_days_badge_id_day_key"
    ON "telegram_active_days"("badge_id", "day");
DO $$ BEGIN
  ALTER TABLE "telegram_active_days" ADD CONSTRAINT "telegram_active_days_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 9. Evidence table: discord_active_days ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "discord_active_days" (
    "id"         TEXT NOT NULL,
    "badge_id"   TEXT NOT NULL,
    "day"        DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discord_active_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "discord_active_days_badge_id_day_key"
    ON "discord_active_days"("badge_id", "day");
DO $$ BEGIN
  ALTER TABLE "discord_active_days" ADD CONSTRAINT "discord_active_days_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 10. Evidence table: governance_participations ─────────────────────────────
CREATE TABLE IF NOT EXISTS "governance_participations" (
    "id"              TEXT NOT NULL,
    "badge_id"        TEXT NOT NULL,
    "proposal_id"     TEXT NOT NULL,
    "participated_at" TIMESTAMP(3) NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "governance_participations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "governance_participations_badge_id_proposal_id_key"
    ON "governance_participations"("badge_id", "proposal_id");
DO $$ BEGIN
  ALTER TABLE "governance_participations" ADD CONSTRAINT "governance_participations_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
