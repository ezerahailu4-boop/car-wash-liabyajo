"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid, Droplet, Box, Bell, Users, BarChart3,
  LogOut, ShieldCheck, Store, UserCircle, X,
  Menu, Sun, Moon, ChevronRight, Receipt, Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchNotifications, markNotificationRead } from "@/lib/queries";
import { initWashOSRealtime } from "@/lib/supabase/realtime";

const ALL_NAV = [
  { href: "/",          label: "Dashboard",  icon: LayoutGrid, roles: ["administrator", "manager"] },
  { href: "/wash",      label: "Wash Entry", icon: Droplet,    roles: ["administrator", "manager"] },
  { href: "/inventory", label: "Inventory",  icon: Box,        roles: ["administrator", "manager"] },
  { href: "/requests",  label: "Requests",   icon: Bell,       roles: ["administrator", "manager"] },
  { href: "/employees", label: "Employees",  icon: Users,      roles: ["administrator", "manager"] },
  { href: "/customers", label: "Customers",  icon: UserCircle, roles: ["administrator", "manager"] },
  { href: "/expenses",  label: "Expenses",   icon: Receipt,    roles: ["administrator", "manager"] },
  { href: "/reports",   label: "Reports",    icon: BarChart3,  roles: ["administrator", "manager"] },
  { href: "/store",     label: "Store",      icon: Store,      roles: ["administrator", "store_keeper"] },
  { href: "/portal",    label: "My Portal",  icon: Sparkles,   roles: ["washer"] },
  { href: "/admin",     label: "Admin",      icon: ShieldCheck,roles: ["administrator"] },
];

const WASHER_ROUTES = ["/portal"];
const STORE_ROUTES  = ["/store"];

/* ── Theme Toggle ─────────────────────────────────────────── */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
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
      className="icon-btn"
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

/* ── Locked layout (washer / store keeper) ────────────────── */
function LockedLayout({ label, icon: Icon, name, role, children }: {
  label: string; icon: React.ElementType; name: string; role: string; children: React.ReactNode;
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
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header
        className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10"
        style={{
          background: "var(--panel)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <Icon size={15} className="text-white" />
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-sm font-semibold leading-none" style={{ color: "var(--text)" }}>
              WashOS
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-sm font-medium leading-none" style={{ color: "var(--text)" }}>{name}</p>
            <p className="text-[11px] mt-0.5 capitalize" style={{ color: "var(--muted)" }}>{role.replace("_", " ")}</p>
          </div>
          <div
            className="avatar w-9 h-9 text-sm"
            style={{ background: "var(--accent)", color: "#041f1e" }}
          >
            {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <button onClick={signOut} className="icon-btn" aria-label="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">{children}</main>
    </div>
  );
}

type Notification = { id: string; message: string; type: string; read: boolean; created_at: string };

/* ── Main Shell ───────────────────────────────────────────── */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [role, setRole]               = useState<string>("administrator");
  const [userName, setUserName]       = useState("Admin");
  const [userInitials, setUserInitials] = useState("AD");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotif, setShowNotif]     = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const notifRef                      = useRef<HTMLDivElement>(null);
  const profileLoaded                 = useRef(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

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
              setUserInitials(sess.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase());
            }
          }
        } catch { /* ignore */ }
      }

      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          const { data: profile } = await supabase
            .from("profiles").select("role, full_name").eq("id", user.id).single();
          if (profile) {
            setRole(profile.role);
            const fullName = profile.full_name ?? "User";
            setUserName(fullName);
            setUserInitials(fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase());
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
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotif(false);
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
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
  }

  if (pathname === "/login" || pathname === "/reset-password") return <>{children}</>;

  if (WASHER_ROUTES.some((r) => pathname.startsWith(r)))
    return (
      <LockedLayout label="Employee Portal" icon={Sparkles} name={userName} role="washer">
        {children}
      </LockedLayout>
    );

  if (STORE_ROUTES.some((r) => pathname.startsWith(r)))
    return (
      <LockedLayout label="Store" icon={Store} name={userName} role="store keeper">
        {children}
      </LockedLayout>
    );

  const NAV    = ALL_NAV.filter((n) => n.roles.includes(role));
  const unread = notifications.filter((n) => !n.read).length;

  const currentPage = NAV.find(
    (n) => n.href === pathname || (n.href !== "/" && pathname.startsWith(n.href))
  );

  /* ── Nav Links (reused in sidebar + drawer) ─────────────── */
  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-0.5">
      {NAV.map((n) => {
        const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
        const Icon   = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative"
            style={{
              background: active ? "var(--panel-2)" : "transparent",
              color:      active ? "var(--accent)"  : "var(--muted)",
              fontWeight: active ? 500 : 400,
            }}
          >
            {active && (
              <span
                className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
            <Icon size={16} className="shrink-0" />
            <span className="flex-1 truncate">{n.label}</span>
            {active && (
              <ChevronRight size={13} style={{ color: "var(--accent)", opacity: 0.6 }} />
            )}
          </Link>
        );
      })}
    </nav>
  );

  /* ── Sidebar ─────────────────────────────────────────────── */
  const Sidebar = ({ drawer = false, onClose }: { drawer?: boolean; onClose?: () => void }) => (
    <aside
      className={`flex flex-col ${drawer ? "w-72 max-w-[85vw]" : "w-[220px] shrink-0"}`}
      style={{
        background:   "var(--panel)",
        borderRight:  "1px solid var(--line)",
        height:       "100%",
        ...(drawer ? { position: "relative", zIndex: 50, boxShadow: "var(--shadow-lg)" } : {}),
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent)" }}
          >
            <Droplet size={15} style={{ color: "#041f1e" }} />
          </div>
          <div>
            <p
              className="leading-none font-semibold text-base"
              style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
            >
              WashOS
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}
            >
              Car Wash ERP
            </p>
          </div>
        </div>
        {drawer && onClose && (
          <button onClick={onClose} className="icon-btn">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav section label */}
      <div className="px-5 mb-1.5">
        <span className="section-label">Navigation</span>
      </div>

      {/* Links */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <NavLinks onClick={onClose} />
      </div>

      {/* Footer */}
      <div className="px-3 pb-5 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
          style={{ color: "var(--muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }}
            onClick={() => setDrawerOpen(false)}
          />
          <Sidebar drawer onClose={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header
          className="flex items-center justify-between px-4 sm:px-6 py-3.5 sticky top-0 z-10"
          style={{
            background:    "var(--panel)",
            borderBottom:  "1px solid var(--line)",
            backdropFilter:"blur(12px)",
            boxShadow:     "var(--shadow-sm)",
          }}
        >
          {/* Left: hamburger + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden icon-btn"
              aria-label="Open menu"
            >
              <Menu size={16} />
            </button>
            <div>
              <h1
                className="text-lg font-semibold leading-none"
                style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
              >
                {currentPage?.label ?? "WashOS"}
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                {new Date().toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif((s) => !s)}
                className="icon-btn relative"
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unread > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: "var(--red)", color: "#fff" }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {showNotif && (
                <div
                  className="absolute right-0 top-12 w-80 rounded-2xl overflow-hidden z-50 fade-in"
                  style={{
                    background:   "var(--panel)",
                    border:       "1px solid var(--line)",
                    boxShadow:    "var(--shadow-lg)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <p
                      className="text-sm font-semibold"
                      style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
                    >
                      Notifications
                    </p>
                    {unread > 0 && (
                      <span className="badge badge-pending">{unread} new</span>
                    )}
                    <button onClick={() => setShowNotif(false)} className="icon-btn w-7 h-7">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y" style={{ ["--tw-divide-color" as string]: "var(--line)" }}>
                    {notifications.length === 0 && (
                      <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--muted)" }}>
                        No notifications yet.
                      </p>
                    )}
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className="w-full text-left px-4 py-3 transition-colors"
                        style={{
                          opacity: n.read ? 0.55 : 1,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div className="flex items-start gap-2.5">
                          {!n.read && (
                            <span
                              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                              style={{ background: "var(--accent)" }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{n.message}</p>
                            <p
                              className="text-[10px] mt-0.5"
                              style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}
                            >
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User info */}
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-sm font-medium leading-none" style={{ color: "var(--text)" }}>{userName}</p>
              <p
                className="text-[11px] mt-0.5 capitalize"
                style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}
              >
                {role.replace("_", " ")}
              </p>
            </div>
            <div
              className="avatar w-9 h-9 text-sm font-semibold shrink-0"
              style={{ background: "var(--accent)", color: "#041f1e" }}
            >
              {userInitials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div
        className="mobile-nav lg:hidden fixed bottom-0 left-0 right-0 z-20"
        style={{
          background:  "var(--panel)",
          borderTop:   "1px solid var(--line)",
          boxShadow:   "0 -4px 12px 0 rgb(0 0 0 / 0.08)",
        }}
      >
        <div className="flex overflow-x-auto scrollbar-none px-2 pt-2 pb-1 gap-0.5">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            const Icon   = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl shrink-0 transition-all"
                style={{ color: active ? "var(--accent)" : "var(--muted-2)" }}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                <span
                  className="text-[9px] font-medium whitespace-nowrap"
                  style={{ fontWeight: active ? 600 : 400 }}
                >
                  {n.label.split(" ")[0]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
