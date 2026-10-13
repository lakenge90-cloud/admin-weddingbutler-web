-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "requestedTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requestedExtraButlers" INTEGER NOT NULL DEFAULT 0;
