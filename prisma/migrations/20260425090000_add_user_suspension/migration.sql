-- Add an explicit suspension flag for admin account control.
ALTER TABLE "User"
ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;
