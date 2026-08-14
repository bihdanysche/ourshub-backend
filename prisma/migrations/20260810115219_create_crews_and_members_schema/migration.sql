-- CreateEnum
CREATE TYPE "crew_member_roles" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "crews" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "avatar" TEXT,
    "cover" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_members" (
    "id" SERIAL NOT NULL,
    "crew_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "crew_member_roles" NOT NULL DEFAULT 'MEMBER',
    "alias" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_invitation_links" (
    "id" SERIAL NOT NULL,
    "crew_id" INTEGER NOT NULL,
    "invite_code" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_invitation_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crew_members_user_id_idx" ON "crew_members"("user_id");

-- CreateIndex
CREATE INDEX "crew_members_crew_id_idx" ON "crew_members"("crew_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_members_crew_id_user_id_key" ON "crew_members"("crew_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_invitation_links_crew_id_key" ON "crew_invitation_links"("crew_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_invitation_links_invite_code_key" ON "crew_invitation_links"("invite_code");

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_invitation_links" ADD CONSTRAINT "crew_invitation_links_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
