"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  Droplet,
  Box,
  Bell,
  Users,
  BarChart3,
  LogOut,
  ShieldCheck,
  Store,
  UserCircle,
  X,
  Menu,
  Sun,
  Moon,
  ChevronRight,
  Receipt,
  Sparkles,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchNotifications, markNotificationRead } from "@/lib/queries";
import { initWashOSRealtime } from "@/lib/supabase/realtime";

type NavGroup = {
  section: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
    badge?: string;
    roles: string[];
  }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    section: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutGrid, roles: ["administrator", "manager"] },
      { href: "/wash", label: "Live Bays & POS", icon: Droplet, badge: "Live", roles: ["administrator", "manager"] },
      { href: "/customers", label: "Customers", icon: UserCircle, roles: ["administrator", "manager"] },
    ],
  },
  {
    section: "Chemical Warehouse",
    items: [
      { href: "/store", label: "Store Warehouse", icon: Store, roles: ["administrator", "store_keeper"] },
      { href: "/inventory", label: "Chemical Stock", icon: Box, roles: ["administrator", "manager"] },
      { href: "/requests", label: "Refill Requests", icon: Bell, roles: ["administrator", "manager"] },
    ],
  },
  {
    section: "Finance & Reports",
    items: [
      { href: "/expenses", label: "Expenses & Cash", icon: Receipt, roles: ["administrator", "manager"] },
      { href: "/reports", label: "Financial Reports", icon: BarChart3, roles: ["administrator", "manager"] },
    ],
  },
  {
    section: "Admin & Team",
    items: [
      { href: "/admin", label: "Admin Hub", icon: ShieldCheck, roles: ["administrator"] },
      { href: "/employees", label: "Staff & Commission", icon: Users, roles: ["administrator", "manager"] },
      { href: "/portal", label: "Attendant Portal", icon: Sparkles, roles: ["administrator", "washer"] },
    ],
  },
];

const WASHER_ROUTES = ["/portal"];
const STORE_ROUTES = ["/store"];

/* ── Theme Toggle ─────────────────────────────────────────── */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="icon-btn rounded-xl border border-line hover:border-line-2 transition-colors"
    >
      {dark ? <Sun size={15} className="text-amber" /> : <Moon size={15} className="text-muted" />}
    </button>
  );
}

/* ── Dedicated Portal Header (for Washer / Storekeeper focused view) ────────────────── */
function DedicatedPortalShell({
  label,
  icon: Icon,
  name,
  role,
  portalType,
  children,
}: {
  label: string;
  icon: React.ElementType;
  name: string;
  role: string;
  portalType: "washer" | "store";
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    if (typeof document !== "undefined") {
      document.cookie = "washos_role=; path=/; max-age=0";
      document.cookie = "washos_session=; path=/; max-age=0";
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("washos_active_session");
      window.location.href = "/login";
    }
  }

  function switchToRole(targetRole: string, path: string) {
    if (typeof document !== "undefined") {
      document.cookie = `washos_role=${targetRole}; path=/; max-age=604800; SameSite=Lax`;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("washos_active_session", JSON.stringify({ role: targetRole, name }));
      window.location.href = path;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text selection:bg-accent selection:text-white">
      <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 sticky top-0 z-30 glass-panel border-b border-line shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent text-slate-950 font-bold shadow-sm shadow-accent/20">
            <Icon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight font-[family-name:var(--font-display)] text-text">
                WashOS
              </span>
              <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded-md bg-panel-2 border border-line text-accent">
                {label}
              </span>
            </div>
            <p className="text-[11px] text-muted font-mono hidden sm:block">
              {portalType === "washer"
                ? "Mobile Attendant Station · Wet-hands touch UI"
                : "Chemical Inventory, Dispensing & Purchase Orders"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Switch back to Admin if user has permissions */}
          <div className="hidden md:flex items-center gap-1.5 mr-2 bg-panel-2 p-1 rounded-xl border border-line text-xs">
            <span className="text-[11px] text-muted px-2 font-mono">Portals:</span>
            <button
              onClick={() => switchToRole("administrator", "/admin")}
              className="px-2.5 py-1 rounded-lg text-muted hover:text-text hover:bg-panel transition-all font-medium"
            >
              Admin
            </button>
            <button
              onClick={() => switchToRole("administrator", "/")}
              className="px-2.5 py-1 rounded-lg text-muted hover:text-text hover:bg-panel transition-all font-medium"
            >
              Bays POS
            </button>
            <button
              onClick={() => switchToRole("store_keeper", "/store")}
              className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                portalType === "store" ? "bg-accent text-slate-950 font-semibold" : "text-muted hover:text-text"
              }`}
            >
              Store
            </button>
            <button
              onClick={() => switchToRole("washer", "/portal")}
              className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                portalType === "washer" ? "bg-accent text-slate-950 font-semibold" : "text-muted hover:text-text"
              }`}
            >
              Washer
            </button>
          </div>

          <ThemeToggle />

          <div className="hidden sm:flex flex-col items-end">
            <p className="text-xs font-semibold text-text leading-none">{name}</p>
            <span className="text-[10px] font-mono text-muted uppercase mt-0.5">
              {role.replace("_", " ")}
            </span>
          </div>

          <div className="w-8 h-8 rounded-xl bg-panel-2 border border-line flex items-center justify-center font-bold text-xs text-text">
            {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>

          <button
            onClick={signOut}
            className="icon-btn text-muted hover:text-red border border-transparent hover:border-red/20 hover:bg-red-dim transition-all"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}

type Notification = { id: string; message: string; type: string; read: boolean; created_at: string };

/* ── Main Executive Shell ─────────────────────────────────── */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<string>("administrator");
  const [userName, setUserName] = useState("Admin");
  const [userInitials, setUserInitials] = useState("AD");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileLoaded = useRef(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    initWashOSRealtime();

    if (!profileLoaded.current) {
      profileLoaded.current = true;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("washos_active_session");
          if (raw) {
            const sess = JSON.parse(raw);
            if (sess.role) setRole(sess.role);
            if (sess.name) {
              setUserName(sess.name);
              setUserInitials(
                sess.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
              );
            }
          }
        } catch { /* ignore */ }
      }

      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .single();
          if (profile) {
            setRole(profile.role);
            const fullName = profile.full_name ?? "User";
            setUserName(fullName);
            setUserInitials(
              fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
            );
          }
        }
        fetchNotifications().then((notifs) => setNotifications(notifs as Notification[]));
      });
    }

    const handleDataChange = () => {
      fetchNotifications().then((notifs) => setNotifications(notifs as Notification[]));
    };
    window.addEventListener("washos_data_change", handleDataChange);
    return () => window.removeEventListener("washos_data_change", handleDataChange);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function signOut() {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    if (typeof document !== "undefined") {
      document.cookie = "washos_role=; path=/; max-age=0";
      document.cookie = "washos_session=; path=/; max-age=0";
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("washos_active_session");
      window.location.href = "/login";
    }
  }

  async function handleNotifClick(n: Notification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
  }

  function switchRole(targetRole: string, path: string) {
    if (typeof document !== "undefined") {
      document.cookie = `washos_role=${targetRole}; path=/; max-age=604800; SameSite=Lax`;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("washos_active_session", JSON.stringify({ role: targetRole, name: userName }));
      window.location.href = path;
    }
  }

  if (pathname === "/login" || pathname === "/reset-password") return <>{children}</>;

  // Dedicated Washer Mobile Portal
  if (role === "washer" || (WASHER_ROUTES.some((r) => pathname.startsWith(r)) && role !== "administrator")) {
    return (
      <DedicatedPortalShell
        label="Attendant Station"
        icon={Sparkles}
        name={userName}
        role="washer"
        portalType="washer"
      >
        {children}
      </DedicatedPortalShell>
    );
  }

  // Dedicated Storekeeper Warehouse Portal
  if (role === "store_keeper" || (STORE_ROUTES.some((r) => pathname.startsWith(r)) && role !== "administrator")) {
    return (
      <DedicatedPortalShell
        label="Store Warehouse"
        icon={Store}
        name={userName}
        role="store_keeper"
        portalType="store"
      >
        {children}
      </DedicatedPortalShell>
    );
  }

  const unread = notifications.filter((n) => !n.read).length;

  /* ── Sidebar Navigation Groups ───────────────────────────── */
  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => {
        const accessibleItems = group.items.filter((item) => item.roles.includes(role));
        if (accessibleItems.length === 0) return null;

        return (
          <div key={group.section} className="space-y-1">
            <div className="px-3 mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted/70">
                {group.section}
              </span>
            </div>

            {accessibleItems.map((n) => {
              const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
              const Icon = n.icon;

              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={onClick}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative ${
                    active
                      ? "bg-accent/10 text-accent font-semibold shadow-xs"
                      : "text-muted hover:text-text hover:bg-panel-2"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                  )}
                  <Icon
                    size={16}
                    className={`shrink-0 transition-transform group-hover:scale-110 ${
                      active ? "text-accent" : "text-muted"
                    }`}
                  />
                  <span className="flex-1 truncate">{n.label}</span>
                  {n.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30 animate-pulse">
                      {n.badge}
                    </span>
                  )}
                  {active && <ChevronRight size={13} className="text-accent/60" />}
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  /* ── Sidebar ─────────────────────────────────────────────── */
  const Sidebar = ({ drawer = false, onClose }: { drawer?: boolean; onClose?: () => void }) => (
    <aside
      className={`flex flex-col ${drawer ? "w-72 max-w-[85vw]" : "w-[240px] shrink-0"} h-full bg-panel border-r border-line`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-4.5 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent text-slate-950 flex items-center justify-center font-black shadow-sm shadow-accent/20">
            <Droplet size={17} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base font-[family-name:var(--font-display)] text-text tracking-tight">
                WashOS
              </span>
              <span className="text-[9px] font-mono uppercase bg-panel-2 px-1.5 py-0.2 rounded border border-line text-accent">
                ERP
              </span>
            </div>
            <p className="text-[10px] text-muted font-mono">Operations Control</p>
          </div>
        </div>
        {drawer && onClose && (
          <button onClick={onClose} className="icon-btn">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Role Quick Switcher for Admin */}
      {role === "administrator" && (
        <div className="px-3 py-3 border-b border-line/60 bg-panel-2/50">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted mb-1.5 px-1">
            <span className="flex items-center gap-1">
              <ArrowRightLeft size={11} /> Switch Portal
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => router.push("/admin")}
              className={`text-[11px] py-1 rounded-lg border text-center transition-all font-medium ${
                pathname === "/admin"
                  ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                  : "bg-panel border-line text-muted hover:text-text"
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => router.push("/store")}
              className={`text-[11px] py-1 rounded-lg border text-center transition-all font-medium ${
                pathname === "/store"
                  ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                  : "bg-panel border-line text-muted hover:text-text"
              }`}
            >
              Store
            </button>
            <button
              onClick={() => router.push("/portal")}
              className={`text-[11px] py-1 rounded-lg border text-center transition-all font-medium ${
                pathname === "/portal"
                  ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                  : "bg-panel border-line text-muted hover:text-text"
              }`}
            >
              Washer
            </button>
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
        <NavLinks onClick={onClose} />
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-line bg-panel-2/30">
        <div className="flex items-center justify-between p-2 rounded-xl bg-panel border border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text truncate">{userName}</p>
              <p className="text-[10px] font-mono text-muted capitalize truncate">{role.replace("_", " ")}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="icon-btn text-muted hover:text-red hover:bg-red-dim/50 transition-colors w-7 h-7"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-bg text-text selection:bg-accent selection:text-white">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0 z-20">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <Sidebar drawer onClose={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 sticky top-0 z-20 glass-panel border-b border-line shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden icon-btn"
              aria-label="Open menu"
            >
              <Menu size={17} />
            </button>

            <div>
              <h1 className="text-base font-bold font-[family-name:var(--font-display)] text-text leading-tight">
                {pathname === "/admin"
                  ? "Admin Control Center"
                  : pathname === "/store"
                  ? "Chemical Store Warehouse"
                  : pathname === "/portal"
                  ? "Washer Bay Station"
                  : pathname === "/wash"
                  ? "Live Bays & POS"
                  : pathname === "/inventory"
                  ? "Chemical Inventory"
                  : pathname === "/expenses"
                  ? "Shift Settlement & Expenses"
                  : pathname === "/reports"
                  ? "Analytics & Reports"
                  : pathname === "/customers"
                  ? "Customer Directory"
                  : pathname === "/employees"
                  ? "Staff & Commission"
                  : "Executive Dashboard"}
              </h1>
              <p className="text-[11px] text-muted font-mono hidden sm:block">
                {new Date().toLocaleDateString("en", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif((s) => !s)}
                className="icon-btn relative rounded-xl border border-line"
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center bg-red text-white animate-pulse">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className="absolute right-0 top-12 w-80 rounded-2xl overflow-hidden z-50 glass-card border border-line shadow-2xl fade-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-panel-2">
                    <p className="text-sm font-semibold text-text">Notifications</p>
                    {unread > 0 && <span className="badge badge-pending">{unread} new</span>}
                    <button onClick={() => setShowNotif(false)} className="icon-btn w-6 h-6">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-line">
                    {notifications.length === 0 && (
                      <p className="px-4 py-6 text-sm text-center text-muted">No notifications yet.</p>
                    )}
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 transition-colors text-xs ${
                          n.read ? "bg-transparent text-muted" : "bg-accent/5 text-text font-medium"
                        }`}
                      >
                        <p>{n.message}</p>
                        <span className="text-[10px] text-muted-2 mt-1 block font-mono">
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
