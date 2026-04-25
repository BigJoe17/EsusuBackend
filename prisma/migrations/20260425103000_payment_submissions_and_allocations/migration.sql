-- Payment submissions are now the pending approval object.
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ContributionAllocationType" AS ENUM ('BUSINESS_FEE', 'USER_SAVINGS');

ALTER TABLE "Contribution"
ADD COLUMN "allocationType" "ContributionAllocationType",
ADD COLUMN "cycleNumber" INTEGER,
ADD COLUMN "dayInCycle" INTEGER,
ADD COLUMN "paymentSubmissionId" TEXT;

CREATE TABLE "PaymentSubmission" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "proofUrl" TEXT NOT NULL,
  "reference" TEXT,
  "selectedStartDate" TIMESTAMP(3) NOT NULL,
  "daysCovered" INTEGER NOT NULL,
  "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,

  CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contribution_allocationType_idx" ON "Contribution"("allocationType");
CREATE INDEX "Contribution_paymentSubmissionId_idx" ON "Contribution"("paymentSubmissionId");
CREATE INDEX "PaymentSubmission_planId_idx" ON "PaymentSubmission"("planId");
CREATE INDEX "PaymentSubmission_userId_idx" ON "PaymentSubmission"("userId");
CREATE INDEX "PaymentSubmission_status_idx" ON "PaymentSubmission"("status");
CREATE INDEX "PaymentSubmission_submittedAt_idx" ON "PaymentSubmission"("submittedAt");

ALTER TABLE "Contribution"
ADD CONSTRAINT "Contribution_paymentSubmissionId_fkey"
FOREIGN KEY ("paymentSubmissionId") REFERENCES "PaymentSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentSubmission"
ADD CONSTRAINT "PaymentSubmission_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "SavingsPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentSubmission"
ADD CONSTRAINT "PaymentSubmission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentSubmission"
ADD CONSTRAINT "PaymentSubmission_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
