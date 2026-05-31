/*
  Warnings:

  - You are about to drop the column `scheduleCron` on the `Agent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "scheduleCron";
