"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCheck, ChevronRight, MessageCircle, Settings } from "lucide-react";
import { notificationsApi } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { useUnreadStore } from "@/store/unread";
import { timeAgo } from "@/lib/utils";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/facilities": "Facilities",
  "/service-requests": "Service Requests",
  "/providers": "Providers",
  "/quotations": "Quotations",
  "/contracts": "Contracts",
  "/jobs": "Jobs",
  "/workers": "Workers",
  "/invoices": "Invoices",
  "/reviews": "Reviews",
  "/notifications": "Notifications",
  "/messages": "Messages",
  "/analytics": "Analytics",
  "/admin": "Admin Cockpit",
  "/admin/verification": "Verification Queue",
  "/payment-history": "Payment & Earnings History",
  "/settings": "Settings",
};

export function TopBar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = useUnreadStore((s) => s.notifications);
  const msgUnread = useUnreadStore((s) => s.messages);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.list();
      setNotifications(res?.notifications ?? []);
    } catch {
      // Ignore polling errors
    }
    void useUnreadStore.getState().refreshNotifications();
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAll = async () => {
    setLoading(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await useUnreadStore.getState().refreshNotifications();
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleMarkOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      await useUnreadStore.getState().refreshNotifications();
    } catch {
      // handle error
    }
  };

  const segments = pathname.split("/").filter(Boolean);
  const mainPath = `/${segments[0] || "dashboard"}`;
  const title = ROUTE_TITLES[pathname] || ROUTE_TITLES[mainPath] || "Overview";
  const lastSegment = segments[segments.length - 1] || "";
  const isInternalId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(lastSegment);

  return (
    <header className="sticky top-2 z-30 mx-3 mb-3 hidden h-14 items-center justify-between rounded-xl border border-ivory/10 bg-pine px-4 text-ivory shadow-raised sm:mx-4 sm:px-5 lg:flex">
      {/* Title & Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">{title}</span>
        {segments.length > 1 && !isInternalId && (
          <>
            <ChevronRight className="h-4 w-4 text-ivory/50" />
            <span className="capitalize text-ivory/70">{lastSegment.replace(/-/g, " ")}</span>
          </>
        )}
      </div>

      {/* Actions: Message -> Notification -> Settings (Right to Left: Settings -> Notification -> Message) */}
      <div className="flex items-center gap-1">
        {user?.avatarUrl && <img src={user.avatarUrl} alt="" className="mr-1 h-7 w-7 rounded-full object-cover" />}
        {role !== "WORKER" && (
          <Link href="/messages" aria-label="Messages" className="relative rounded-full p-2 text-ivory/80 transition-colors hover:bg-ivory/10 hover:text-ivory">
            <MessageCircle className="h-5 w-5" />
            {msgUnread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-ivory">
                {msgUnread > 99 ? "99+" : msgUnread}
              </span>
            )}
          </Link>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              const willOpen = !open;
              setOpen(willOpen);
              if (willOpen && unreadCount > 0) {
                handleMarkAll();
              }
            }}
            className="relative rounded-full p-2 text-ivory/80 transition-colors hover:bg-ivory/10 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-ivory">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="animate-fade-in absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-ivory shadow-raised z-50 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-sand/40">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-charcoal">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-brass-soft px-2 py-0.5 text-xs font-semibold text-pine">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs font-medium text-pine hover:underline disabled:opacity-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-sage">No notifications yet</div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-3 text-xs transition-colors hover:bg-sand/30 ${
                        !n.isRead ? "bg-brass-soft/40" : ""
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          !n.isRead ? "bg-pine" : "bg-border"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-charcoal truncate">{n.title}</p>
                        {n.message && <p className="text-sage line-clamp-2 mt-0.5">{n.message}</p>}
                        <p className="text-[10px] text-sage/80 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => handleMarkOne(n.id, e)}
                          className="text-[11px] text-pine font-medium hover:underline shrink-0"
                        >
                          Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border bg-sand/30 px-4 py-2.5 text-center">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-pine hover:underline block"
                >
                  View all notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link href="/settings" aria-label="Settings" className="rounded-full p-2 text-ivory/80 transition-colors hover:bg-ivory/10 hover:text-ivory">
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
