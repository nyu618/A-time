-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "lineUid" TEXT NOT NULL,
    "displayName" TEXT,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "fullName" TEXT,
    "fullNameKana" TEXT,
    "birthDate" TEXT,
    "phoneNumber" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "bankName" TEXT,
    "branchName" TEXT,
    "accountType" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("lineUid")
);

-- CreateTable
CREATE TABLE "Queue" (
    "id" SERIAL NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "targetDate" TEXT NOT NULL DEFAULT '',
    "dailyNumber" INTEGER NOT NULL DEFAULT 0,
    "cancelCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),

    CONSTRAINT "Queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" SERIAL NOT NULL,
    "queueId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "idCardImageUrl" TEXT,
    "signatureData" TEXT,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isInvoiceRegistered" BOOLEAN NOT NULL DEFAULT false,
    "isAgreedToTerms" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_queueId_key" ON "Agreement"("queueId");

-- AddForeignKey
ALTER TABLE "Queue" ADD CONSTRAINT "Queue_lineUserId_fkey" FOREIGN KEY ("lineUserId") REFERENCES "User"("lineUid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("lineUid") ON DELETE RESTRICT ON UPDATE CASCADE;

