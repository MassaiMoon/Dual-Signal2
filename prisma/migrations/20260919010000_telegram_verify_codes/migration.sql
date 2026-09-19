-- CreateTable
CREATE TABLE "telegram_verify_codes" (
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_verify_codes_pkey" PRIMARY KEY ("code")
);

-- AddForeignKey
ALTER TABLE "telegram_verify_codes" ADD CONSTRAINT "telegram_verify_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
