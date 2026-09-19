-- Phase 4 messaging, SLA tracking, recurring schedules and compliance metadata.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WORKER';

CREATE TABLE IF NOT EXISTS "VerificationDocument" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "resubmittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "VerificationDocument" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "VerificationDocument" ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;
ALTER TABLE "VerificationDocument" ADD COLUMN IF NOT EXISTS "resubmittedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationDocument_fileId_key" ON "VerificationDocument"("fileId");
CREATE INDEX IF NOT EXISTS "VerificationDocument_providerId_idx" ON "VerificationDocument"("providerId");

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inApp" BOOLEAN NOT NULL DEFAULT true,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "categories" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

CREATE TABLE "MessageThread" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "contractId" TEXT,
  "serviceRequestId" TEXT,
  "subject" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SlaPolicy" (
  "id" TEXT NOT NULL,
  "providerId" TEXT,
  "name" TEXT NOT NULL,
  "responseHours" INTEGER,
  "resolutionHours" INTEGER NOT NULL,
  "warningHours" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobSla" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "policyId" TEXT,
  "deadline" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
  "breachedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobSla_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractSchedule" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "frequency" "RecurrenceFrequency" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "occurrences" INTEGER NOT NULL DEFAULT 0,
  "occurrencesLimit" INTEGER,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "lastGeneratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobSla_jobId_key" ON "JobSla"("jobId");
CREATE UNIQUE INDEX "ContractSchedule_contractId_key" ON "ContractSchedule"("contractId");
CREATE INDEX "MessageThread_organizationId_updatedAt_idx" ON "MessageThread"("organizationId", "updatedAt");
CREATE INDEX "MessageThread_providerId_updatedAt_idx" ON "MessageThread"("providerId", "updatedAt");
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");
CREATE INDEX "Message_senderId_readAt_idx" ON "Message"("senderId", "readAt");
CREATE INDEX "SlaPolicy_providerId_isActive_idx" ON "SlaPolicy"("providerId", "isActive");
CREATE INDEX "JobSla_status_deadline_idx" ON "JobSla"("status", "deadline");
CREATE INDEX "ContractSchedule_paused_nextRunAt_idx" ON "ContractSchedule"("paused", "nextRunAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationDocument_providerId_fkey') THEN
    ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationDocument_fileId_fkey') THEN
    ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_fileId_fkey"
      FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationDocument_reviewedById_fkey') THEN
    ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationPreference_userId_fkey') THEN
    ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobSla" ADD CONSTRAINT "JobSla_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobSla" ADD CONSTRAINT "JobSla_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "SlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractSchedule" ADD CONSTRAINT "ContractSchedule_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
