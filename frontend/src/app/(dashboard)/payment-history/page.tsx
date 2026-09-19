"use client";

import { PageHeader } from "@/components/ui/kit";
import { useAuthStore } from "@/store/auth";
import { PaymentHistoryContent } from "@/components/payments/PaymentHistoryContent";

export default function PaymentHistoryPage() {
  const { user } = useAuthStore();
  const isProvider = user?.role === "PROVIDER";
  const title = isProvider ? "Earnings History" : "Payment History";
  const subtitle = isProvider ? "All payments received across your contracts." : "All payments made across your providers and contracts.";
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <PaymentHistoryContent />
    </div>
  );
}
