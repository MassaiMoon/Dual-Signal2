-- Add provenance fields to discord_active_days
ALTER TABLE "discord_active_days" ADD COLUMN "discord_handle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "discord_active_days" ADD COLUMN "guild_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "discord_active_days" ADD COLUMN "channel_id" TEXT NOT NULL DEFAULT '';
