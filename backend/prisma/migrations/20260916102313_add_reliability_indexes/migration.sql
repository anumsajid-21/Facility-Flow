-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_status_idx" ON "Payment"("invoiceId", "status");
