-- CreateTable
CREATE TABLE "LookupOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LookupOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LookupOtp_phone_createdAt_idx" ON "LookupOtp"("phone", "createdAt");
