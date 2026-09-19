"use client";
import { useEffect, useState } from "react";
import { Bell, CheckCheck, Check } from "lucide-react";
import { notificationsApi } from "@/services/api";
import { Card, PageHeader, EmptyState, Loading, StatusBadge } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { dateShort, timeShort, humanize } from "@/lib/utils";

export default function NotificationsPage() {
  const [data, setData] = useState<{ notifications: any[]; unreadCount: number } | null>(null);
  const [busy, setBusy] = useState("");

  const load = async () => {
    try {
      const d: any = await notificationsApi.list();
      setData({ notifications: d?.notifications ?? [], unreadCount: d?.unreadCount ?? 0 });
    } catch {
      setData({ notifications: [], unreadCount: 0 });
    }
  };

  useEffect(() => {
    notificationsApi.list().then(async (d: any) => {
      setData({ notifications: d?.notifications ?? [], unreadCount: d?.unreadCount ?? 0 });
      if ((d?.unreadCount ?? 0) > 0) {
        await notificationsApi.markAllRead().catch(() => {});
        setData((prev) => prev ? { notifications: prev.notifications.map((n) => ({ ...n, isRead: true })), unreadCount: 0 } : null);
      }
    }).catch(() => setData({ notifications: [], unreadCount: 0 }));
  }, []);

  const markRead = async (id: string) => {
    setBusy(id);
    try { await notificationsApi.markRead(id); await load(); } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  const markAll = async () => {
    setBusy("all");
    try { await notificationsApi.markAllRead(); toast.success("All caught up"); await load(); } catch (e: any) { toast.error("Failed", e?.message); } finally { setBusy(""); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={data ? `${data.unreadCount} unread` : "Updates about quotations, jobs, approvals and payments"}
        actions={data && data.unreadCount > 0 ? <Button variant="outline" size="sm" loading={busy === "all"} onClick={markAll}><CheckCheck className="h-4 w-4" /> Mark all read</Button> : undefined}
      />

      {!data ? <Loading /> : data.notifications.length === 0 ? (
        <Card><EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="Updates about quotations, contracts, jobs, approvals and payments will appear here." /></Card>
      ) : (
        <Card className="divide-y divide-border">
          {data.notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.isRead ? "" : "bg-pine/5"}`}>
              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-border" : "bg-pine"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm ${n.isRead ? "text-sage" : "font-semibold text-charcoal"}`}>{n.title}</p>
                  <StatusBadge status={n.type} />
                </div>
                {n.message && <p className="mt-0.5 text-sm text-sage">{n.message}</p>}
                <p className="mt-1 text-xs text-sage">{dateShort(n.createdAt)} {timeShort(n.createdAt)} · {humanize(n.type)}</p>
              </div>
              {!n.isRead && (
                <Button variant="outline" size="sm" loading={busy === n.id} onClick={() => markRead(n.id)}><Check className="h-4 w-4" /> Read</Button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
