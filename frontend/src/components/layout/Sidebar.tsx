"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Building2, FileText, Users, Quote, FileSignature,
  HardHat, ReceiptText, Star, Settings, LogOut, Menu, X, ChevronLeft, UserCheck,
  Bell, Shield, MessageCircle, BarChart3,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useUnreadStore } from "@/store/unread";
import { cn } from "@/lib/utils";

const ALL_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["HIRING_ORG", "PROVIDER", "ADMIN", "WORKER"] },
  { href: "/facilities", label: "Facilities", icon: Building2, roles: ["HIRING_ORG"] },
  { href: "/service-requests", label: "Service Requests", icon: FileText, roles: ["HIRING_ORG"] },
  { href: "/providers", label: "Providers", icon: Users, roles: ["HIRING_ORG", "ADMIN"] },
  { href: "/quotations", label: "Quotations", icon: Quote, roles: ["HIRING_ORG", "PROVIDER", "ADMIN"] },
  { href: "/contracts", label: "Contracts", icon: FileSignature, roles: ["HIRING_ORG", "PROVIDER", "ADMIN"] },
  { href: "/jobs", label: "Jobs", icon: HardHat, roles: ["HIRING_ORG", "PROVIDER", "ADMIN", "WORKER"] },
  { href: "/workers", label: "Workers", icon: UserCheck, roles: ["PROVIDER"] },
  { href: "/invoices", label: "Invoices & Payments", icon: ReceiptText, roles: ["HIRING_ORG", "PROVIDER", "ADMIN"] },
  { href: "/reviews", label: "Reviews", icon: Star, roles: ["HIRING_ORG", "PROVIDER", "ADMIN"] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: ["HIRING_ORG", "PROVIDER", "ADMIN", "WORKER"] },
  { href: "/messages", label: "Messages", icon: MessageCircle, roles: ["HIRING_ORG", "PROVIDER", "ADMIN"] },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["HIRING_ORG", "ADMIN"] },
  { href: "/admin", label: "Admin", icon: Shield, roles: ["ADMIN"] },
  { href: "/admin/verification", label: "Verification queue", icon: Shield, roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["HIRING_ORG", "PROVIDER", "ADMIN", "WORKER"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const unreadMessages = useUnreadStore((s) => s.messages);
  const unreadNotifications = useUnreadStore((s) => s.notifications);

  const role = user?.role ?? "HIRING_ORG";
  const nav = ALL_NAV.filter((n) => (n.roles as string[]).includes(role));

  const logoutAndGo = () => {
    logout();
    router.push("/login");
  };

  const content = (isCollapsed: boolean) => (
    <>
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brass text-sm font-bold text-pine-darker">FF</div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate font-semibold text-ivory">FacilityFlow</p>
            <p className="truncate text-[11px] text-sand/60">Facility operations</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-ivory/10 text-ivory" : "text-sand/70 hover:bg-ivory/5 hover:text-ivory",
                isCollapsed && "justify-center px-2",
              )}
              title={item.label}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brass" : "text-sand/60 group-hover:text-brass")} />
              {!isCollapsed && (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2 truncate">
                  <span className="truncate">{item.label}</span>
                  {item.href === "/messages" && unreadMessages > 0 && <span className="rounded-full bg-terracotta px-1.5 text-[10px] text-ivory">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
                  {item.href === "/notifications" && unreadNotifications > 0 && <span className="rounded-full bg-terracotta px-1.5 text-[10px] text-ivory">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-ivory/10 p-3", isCollapsed && "px-2")}>
        {!isCollapsed && (
          <div className="mb-2 flex items-center gap-2.5 px-1">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass/20 text-xs font-semibold text-brass">{(user?.name ?? "?").slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ivory">{user?.name ?? "Signed in"}</p>
              <p className="truncate text-[11px] text-sand/60">
                {role === "HIRING_ORG" ? "Hiring organization" : role === "PROVIDER" ? "Service provider" : role === "WORKER" ? "Service worker" : "Administrator"}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={logoutAndGo}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sand/70 transition-colors hover:bg-terracotta hover:text-ivory",
            isCollapsed && "justify-center px-2",
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!isCollapsed && "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-pine px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-xs font-bold text-pine-darker">FF</div>
          <span className="font-semibold text-ivory">FacilityFlow</span>
        </div>
        <div className="flex items-center gap-1">
          {role !== "WORKER" && (
            <Link href="/messages" aria-label="Messages" className="relative rounded-lg p-1.5 text-ivory hover:bg-ivory/10">
              <MessageCircle className="h-5 w-5" />
              {unreadMessages > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-ivory">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
            </Link>
          )}
          <Link href="/notifications" aria-label="Notifications" className="relative rounded-lg p-1.5 text-ivory hover:bg-ivory/10">
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-ivory">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
          </Link>
          <Link href="/settings" aria-label="Settings" className="rounded-lg p-1.5 text-ivory hover:bg-ivory/10">
            <Settings className="h-5 w-5" />
          </Link>
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-ivory hover:bg-ivory/10" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-pine-darker/60" onClick={() => setMobileOpen(false)} />
          <div className="animate-fade-in absolute left-0 top-0 flex h-full w-72 flex-col bg-pine">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-1 text-ivory hover:bg-ivory/10" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {content(false)}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky left-0 top-0 hidden h-screen shrink-0 flex-col bg-pine transition-all duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        {content(collapsed)}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-ivory text-sage shadow-card hover:text-charcoal"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </aside>
    </>
  );
}
