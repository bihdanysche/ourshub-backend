-- CreateEnum
CREATE TYPE "expense_pay_history_types" AS ENUM ('PAY', 'INC');

-- CreateTable
CREATE TABLE "splits" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT,
    "crew_id" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_expenses" (
    "id" SERIAL NOT NULL,
    "split_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT,
    "spender_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "split_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_members" (
    "id" SERIAL NOT NULL,
    "split_expense_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mustPay" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "split_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_pay_histories" (
    "id" SERIAL NOT NULL,
    "split_id" INTEGER NOT NULL,
    "split_expense_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "expense_pay_history_types" NOT NULL,
    "msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_pay_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "splits_crew_id_idx" ON "splits"("crew_id");

-- CreateIndex
CREATE INDEX "split_expenses_split_id_idx" ON "split_expenses"("split_id");

-- CreateIndex
CREATE INDEX "split_expenses_spender_id_idx" ON "split_expenses"("spender_id");

-- CreateIndex
CREATE INDEX "split_members_user_id_idx" ON "split_members"("user_id");

-- CreateIndex
CREATE INDEX "split_members_split_expense_id_idx" ON "split_members"("split_expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "split_members_split_expense_id_user_id_key" ON "split_members"("split_expense_id", "user_id");

-- CreateIndex
CREATE INDEX "expense_pay_histories_split_id_idx" ON "expense_pay_histories"("split_id");

-- CreateIndex
CREATE INDEX "expense_pay_histories_split_expense_id_idx" ON "expense_pay_histories"("split_expense_id");

-- CreateIndex
CREATE INDEX "expense_pay_histories_user_id_idx" ON "expense_pay_histories"("user_id");

-- AddForeignKey
ALTER TABLE "splits" ADD CONSTRAINT "splits_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_expenses" ADD CONSTRAINT "split_expenses_split_id_fkey" FOREIGN KEY ("split_id") REFERENCES "splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_expenses" ADD CONSTRAINT "split_expenses_spender_id_fkey" FOREIGN KEY ("spender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_members" ADD CONSTRAINT "split_members_split_expense_id_fkey" FOREIGN KEY ("split_expense_id") REFERENCES "split_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_members" ADD CONSTRAINT "split_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_pay_histories" ADD CONSTRAINT "expense_pay_histories_split_id_fkey" FOREIGN KEY ("split_id") REFERENCES "splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_pay_histories" ADD CONSTRAINT "expense_pay_histories_split_expense_id_fkey" FOREIGN KEY ("split_expense_id") REFERENCES "split_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_pay_histories" ADD CONSTRAINT "expense_pay_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
