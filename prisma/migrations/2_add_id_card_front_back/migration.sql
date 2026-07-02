-- AlterTable
ALTER TABLE "Agreement" RENAME COLUMN "idCardImageUrl" TO "idCardImageFront";
ALTER TABLE "Agreement" ADD COLUMN "idCardImageBack" TEXT;
