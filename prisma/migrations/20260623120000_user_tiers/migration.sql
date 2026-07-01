-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('free', 'supporter');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "tier" "UserTier" NOT NULL DEFAULT 'free';
