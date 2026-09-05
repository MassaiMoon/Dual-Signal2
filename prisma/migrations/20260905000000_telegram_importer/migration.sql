-- Migration: Telegram Export Importer
-- Adds TelegramImport audit log, TelegramImportIdentity review queue,
-- and provenance columns on TelegramActiveDay.

-- ─── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "ImportStatus" AS ENUM ('COMPLETED', 'FAILED', 'DRY_RUN');
CREATE TYPE "IdentityStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'AMBIGUOUS', 'LINKED');

-- ─── TelegramImport — audit log per upload job ────────────────────────────────

CREATE TABLE "telegram_imports" (
    "id"                  TEXT NOT NULL,
    "filename"            TEXT NOT NULL,
    "message_count"       INTEGER NOT NULL DEFAULT 0,
    "matched_users"       INTEGER NOT NULL DEFAULT 0,
    "unmatched_users"     INTEGER NOT NULL DEFAULT 0,
    "active_days_created" INTEGER NOT NULL DEFAULT 0,
    "duplicates_ignored"  INTEGER NOT NULL DEFAULT 0,
    "imported_week_start" TEXT,
    "imported_week_end"   TEXT,
    "status"              "ImportStatus" NOT NULL DEFAULT 'COMPLETED',
    "error"               TEXT,
    "is_dry_run"          BOOLEAN NOT NULL DEFAULT false,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_imports_pkey" PRIMARY KEY ("id")
);

-- ─── TelegramImportIdentity — per-identity record (matched + unmatched) ───────

CREATE TABLE "telegram_import_identities" (
    "id"               TEXT NOT NULL,
    "import_id"        TEXT NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "handle"           TEXT NOT NULL,
    "display_name"     TEXT NOT NULL,
    "message_count"    INTEGER NOT NULL DEFAULT 0,
    "unique_days"      INTEGER NOT NULL DEFAULT 0,
    "first_seen_date"  TEXT NOT NULL,
    "last_seen_date"   TEXT NOT NULL,
    "active_dates"     JSONB NOT NULL DEFAULT '[]',
    "matched_user_id"  TEXT,
    "matched_badge_id" TEXT,
    "match_reason"     TEXT,
    "status"           "IdentityStatus" NOT NULL DEFAULT 'UNMATCHED',
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_import_identities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "telegram_import_identities_import_id_fkey"
        FOREIGN KEY ("import_id") REFERENCES "telegram_imports"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "telegram_import_identities_import_id_telegram_user_id_key"
    ON "telegram_import_identities"("import_id", "telegram_user_id");

-- ─── Provenance columns on TelegramActiveDay ──────────────────────────────────

ALTER TABLE "telegram_active_days"
    ADD COLUMN "source_import_id"          TEXT,
    ADD COLUMN "telegram_provider_user_id" TEXT,
    ADD COLUMN "first_message_id"          TEXT;

ALTER TABLE "telegram_active_days"
    ADD CONSTRAINT "telegram_active_days_source_import_id_fkey"
        FOREIGN KEY ("source_import_id") REFERENCES "telegram_imports"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
