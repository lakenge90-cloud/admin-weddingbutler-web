-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "cancelReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" INTEGER NOT NULL DEFAULT 0;
