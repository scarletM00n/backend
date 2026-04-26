-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email_verification_code_expires_at" TIMESTAMP(3),
ADD COLUMN     "email_verification_code_hash" TEXT,
ADD COLUMN     "email_verification_sent_at" TIMESTAMP(3),
ADD COLUMN     "is_email_verified" BOOLEAN NOT NULL DEFAULT false;
