-- Migration: X Ingestion System
-- Extends x_posts with classification + refresh tracking,
-- extends external_accounts with X-specific cursor fields,
-- adds XPostStatus enum and XApiUsage budget ledger.

-- ─── 1. XPostStatus enum ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "XPostStatus" AS ENUM ('ACTIVE', 'UNAVAILABLE', 'DELETED', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. Extend x_posts ───────────────────────────────────────────────────────

ALTER TABLE "x_posts"
  ADD COLUMN IF NOT EXISTS "author_x_user_id"    TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "author_handle"        TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "qualifies"            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "matched_keyword"      TEXT,
  ADD COLUMN IF NOT EXISTS "first_observed_views" BIGINT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "first_seen_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_checked_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "next_check_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "check_count"          INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status"               "XPostStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill first_observed_views = public_views for existing rows (best effort)
UPDATE "x_posts" SET "first_observed_views" = "public_views" WHERE "first_observed_views" = 0 AND "public_views" > 0;

-- Indexes for efficient sync queries
CREATE INDEX IF NOT EXISTS "x_posts_next_check_at_idx"    ON "x_posts"("next_check_at");
CREATE INDEX IF NOT EXISTS "x_posts_badge_qualifies_idx"  ON "x_posts"("badge_id", "qualifies");

-- ─── 3. Extend external_accounts with X cursor fields ────────────────────────

ALTER TABLE "external_accounts"
  ADD COLUMN IF NOT EXISTS "last_x_post_id" TEXT,
  ADD COLUMN IF NOT EXISTS "x_resolved_at"  TIMESTAMP(3);

-- ─── 4. XApiUsage budget ledger ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "x_api_usage" (
  "id"             TEXT         NOT NULL,
  "billing_cycle"  TEXT         NOT NULL,
  "endpoint"       TEXT         NOT NULL,
  "resource_count" INTEGER      NOT NULL DEFAULT 0,
  "estimated_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_api_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "x_api_usage_billing_cycle_idx" ON "x_api_usage"("billing_cycle");
