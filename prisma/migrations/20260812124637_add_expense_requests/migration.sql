-- AlterTable
ALTER TABLE "expense_pay_histories" ADD COLUMN     "proc_by_request" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "expense_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expense_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_requests_user_id_idx" ON "expense_requests"("user_id");

-- CreateIndex
CREATE INDEX "expense_requests_expense_id_idx" ON "expense_requests"("expense_id");

-- AddForeignKey
ALTER TABLE "expense_requests" ADD CONSTRAINT "expense_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_requests" ADD CONSTRAINT "expense_requests_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "split_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
