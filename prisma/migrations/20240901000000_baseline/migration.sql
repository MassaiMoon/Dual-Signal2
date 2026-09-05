-- Baseline migration — represents the initial schema created by prisma db push.
-- All statements use IF NOT EXISTS / DO blocks so they are safe to run against
-- an existing database that already has these tables and types.

-- CreateEnum (idempotent)
DO $$ BEGIN CREATE TYPE "Tier" AS ENUM ('INITIATE','EXPLORER','BUILDER','STAKEHOLDER','GENESIS','LEGEND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "EventSource" AS ENUM ('MOCK','DUAL','DISCORD','TELEGRAM','TWITTER','LINKEDIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "EventStatus" AS ENUM ('PENDING','PROCESSED','REJECTED','DUPLICATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "UpdateStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable users
CREATE TABLE IF NOT EXISTS "users" (
    "id"         TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable badges
CREATE TABLE IF NOT EXISTS "badges" (
    "id"                   TEXT NOT NULL,
    "user_id"              TEXT NOT NULL,
    "dual_object_id"       TEXT NOT NULL,
    "dual_template_id"     TEXT NOT NULL,
    "signal_score"         INTEGER NOT NULL DEFAULT 0,
    "cached_tier"          "Tier" NOT NULL DEFAULT 'INITIATE',
    "x_signal_level"       INTEGER NOT NULL DEFAULT 0,
    "telegram_level"       INTEGER NOT NULL DEFAULT 0,
    "governance_level"     INTEGER NOT NULL DEFAULT 0,
    "holder_level"         INTEGER NOT NULL DEFAULT 0,
    "x_signal_impressions" INTEGER NOT NULL DEFAULT 0,
    "telegram_active_days" INTEGER NOT NULL DEFAULT 0,
    "governance_votes"     INTEGER NOT NULL DEFAULT 0,
    "holder_qual_days"     INTEGER NOT NULL DEFAULT 0,
    "is_og"                BOOLEAN NOT NULL DEFAULT false,
    "wallet_address"       TEXT NOT NULL DEFAULT '',
    "member_since"         TEXT NOT NULL DEFAULT '',
    "discord_handle"       TEXT NOT NULL DEFAULT '',
    "telegram_handle"      TEXT NOT NULL DEFAULT '',
    "x_handle"             TEXT NOT NULL DEFAULT '',
    "last_integrity_hash"  TEXT NOT NULL DEFAULT '',
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable external_accounts
CREATE TABLE IF NOT EXISTS "external_accounts" (
    "id"               TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "source"           "EventSource" NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "handle"           TEXT NOT NULL,
    "verified_at"      TIMESTAMP(3),
    CONSTRAINT "external_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable events
CREATE TABLE IF NOT EXISTS "events" (
    "id"                  TEXT NOT NULL,
    "source"              "EventSource" NOT NULL,
    "source_event_id"     TEXT NOT NULL,
    "content_id"          TEXT NOT NULL DEFAULT '',
    "external_account_id" TEXT,
    "type"                TEXT NOT NULL,
    "status"              "EventStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason"    TEXT,
    "payload"             JSONB NOT NULL DEFAULT '{}',
    "occurred_at"         TIMESTAMP(3) NOT NULL,
    "processed_at"        TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable badge_updates
CREATE TABLE IF NOT EXISTS "badge_updates" (
    "id"              TEXT NOT NULL,
    "badge_id"        TEXT NOT NULL,
    "requested_state" JSONB NOT NULL,
    "status"          "UpdateStatus" NOT NULL DEFAULT 'PENDING',
    "attempts"        INTEGER NOT NULL DEFAULT 0,
    "dual_action_id"  TEXT,
    "error_message"   TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "badge_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "badges_user_id_key"
    ON "badges"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "external_accounts_source_external_user_id_key"
    ON "external_accounts"("source", "external_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "events_source_source_event_id_key"
    ON "events"("source", "source_event_id");

-- AddForeignKey (safe: skip if constraint already exists)
DO $$ BEGIN
  ALTER TABLE "badges" ADD CONSTRAINT "badges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "external_accounts" ADD CONSTRAINT "external_accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_external_account_id_fkey"
    FOREIGN KEY ("external_account_id") REFERENCES "external_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "badge_updates" ADD CONSTRAINT "badge_updates_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
