-- AddColumn: Badge.governance_activity_points
ALTER TABLE "badges" ADD COLUMN "governance_activity_points" INTEGER NOT NULL DEFAULT 0;

-- AddColumns: ExternalAccount forum cursor fields
ALTER TABLE "external_accounts" ADD COLUMN "last_forum_post_id" INTEGER;
ALTER TABLE "external_accounts" ADD COLUMN "forum_synced_at" TIMESTAMP(3);

-- CreateEnum: GovernanceActivityType
CREATE TYPE "GovernanceActivityType" AS ENUM ('COMMENT', 'TOPIC_CREATED', 'FORMAL_PROPOSAL', 'POLL_PARTICIPATION');

-- CreateEnum: GovernanceActivityStatus
CREATE TYPE "GovernanceActivityStatus" AS ENUM ('ACTIVE', 'UNAVAILABLE', 'DELETED', 'MANUAL');

-- CreateEnum: GovernanceActivitySource
CREATE TYPE "GovernanceActivitySource" AS ENUM ('AUTOMATED', 'MANUAL_ADMIN');

-- CreateTable: governance_activities
CREATE TABLE "governance_activities" (
    "id"             TEXT NOT NULL,
    "badge_id"       TEXT NOT NULL,
    "forum_user_id"  INTEGER NOT NULL,
    "forum_username" TEXT NOT NULL,
    "topic_id"       INTEGER NOT NULL,
    "post_id"        TEXT NOT NULL,
    "activity_type"  "GovernanceActivityType" NOT NULL,
    "points_awarded" INTEGER NOT NULL,
    "occurred_at"    TIMESTAMP(3) NOT NULL,
    "topic_url"      TEXT NOT NULL DEFAULT '',
    "status"         "GovernanceActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "source"         "GovernanceActivitySource" NOT NULL DEFAULT 'AUTOMATED',
    "verified_by"    TEXT,
    "verified_at"    TIMESTAMP(3),
    "admin_note"     TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_activities_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: dedup by badge + post + activity type
CREATE UNIQUE INDEX "governance_activities_badge_id_post_id_activity_type_key"
    ON "governance_activities"("badge_id", "post_id", "activity_type");

-- CreateIndex: lookup by badge + type
CREATE INDEX "governance_activities_badge_id_activity_type_idx"
    ON "governance_activities"("badge_id", "activity_type");

-- AddForeignKey
ALTER TABLE "governance_activities"
    ADD CONSTRAINT "governance_activities_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "badges"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
