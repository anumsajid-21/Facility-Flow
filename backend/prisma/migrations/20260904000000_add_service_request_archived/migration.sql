-- Add isArchived to ServiceRequest
ALTER TABLE "ServiceRequest" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;