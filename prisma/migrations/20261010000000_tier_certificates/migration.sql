-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('AWAITING_WALLET', 'MINTED', 'TRANSFERRED', 'FAILED');

-- CreateTable
CREATE TABLE "tier_certificates" (
    "id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'AWAITING_WALLET',
    "score_at_achievement" INTEGER NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL,
    "serial" INTEGER,
    "dual_object_id" TEXT,
    "wallet_address" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tier_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tier_certificates_badge_id_tier_key" ON "tier_certificates"("badge_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "tier_certificates_tier_serial_key" ON "tier_certificates"("tier", "serial");

-- CreateIndex
CREATE INDEX "tier_certificates_status_idx" ON "tier_certificates"("status");

-- AddForeignKey
ALTER TABLE "tier_certificates" ADD CONSTRAINT "tier_certificates_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
