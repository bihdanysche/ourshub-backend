-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username_lower" TEXT;

-- UpdateExistingUsers
UPDATE "User" SET "username_lower" = LOWER("username") WHERE "username" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_lower_key" ON "User"("username_lower");
