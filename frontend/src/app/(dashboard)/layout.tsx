"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAuthStore } from "@/store/auth";
import { useUnreadStore } from "@/store/unread";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready, restore } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!ready) void restore();
  }, [ready, restore]);

  useEffect(() => {
    if (ready && !isAuthenticated) router.push("/login");
  }, [ready, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void useUnreadStore.getState().refreshAll();
    const interval = setInterval(() => void useUnreadStore.getState().refreshAll(), 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
