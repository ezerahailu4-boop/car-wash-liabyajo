"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid, Droplet, Box, Bell, Users, BarChart3,
  LogOut, ShieldCheck, Store, UserCircle, X,
  Menu, Sun, Moon, ChevronRight, Receipt,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchNotifications, markNotificationRead } from "@/lib/queries";

const ALL_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, roles: ["administrator", "manager"] },
  { href: "/wash", label: "Wash Entry", icon: Droplet, roles: ["administrator", "manager"] },
  { href: "/inventory", label: "Inventory", icon: Box, roles: ["administrator", "manager"] },
  { href: "/requests", label: "Requests", icon: Bell, roles: ["administrator", "manager"] },
  { href: "/employees", label: "Employees", icon: Users, roles: ["administrator", "manager"] },
  { href: "/customers", label: "Customers", icon: UserCircle, roles: ["administrator", "manager"] },
  { href: "/expenses", label: "Expenses", icon: Receipt, roles: ["administrator", "manager"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["administrator", "manager"] },
  { href: "/store", label: "Store", icon: Store, roles: ["administrator", "store_keeper"] },
  { href: "/portal", label: "My Portal", icon: UserCircle, roles: ["washer"] },
  { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["administrator"] },
];

const WASHER_ROUTES = ["/portal"];
const STORE_ROUTES = ["/store"];

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
    <button onClick={toggle} aria-label="Toggle theme"
      className="rounded-xl p-2.5 bg-[var(--panel-2)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] transition">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function LockedLayout({ label, icon: Icon, name, role, children }: {
  label: string; icon: React.ElementType; name: string; role: string; children: React.ReactNode;
}) {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--accent)]">
            <Icon size={16} className="text-white" />
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-base leading-none text-[var(--text)]">WashOS</p>
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--muted)]">{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-[var(--text)]">{name}</p>
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--muted)] capitalize">{role.replace("_", " ")}</p>
          </div>
          <div className="w-9 h-9 rounded-full font-[family-name:var(--font-display)] flex items-center justify-center text-sm bg-[var(--accent)] text-white">
            {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <button onClick={signOut} className="rounded-xl p-2.5 bg-[var(--panel-2)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]">
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <main className="p-4 sm:p-6 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

type Notification = { id: string; message: string; type: string; read: boolean; created_at: string };

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

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Load profile only once, not on every route change
  useEffect(() => {
    if (profileLoaded.current) return;
    profileLoaded.current = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
      if (profile) {
        setRole(profile.role);
        const fullName = profile.full_name ?? "User";
        setUserName(fullName);
        setUserInitials(fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase());
        const notifs = await fetchNotifications(user.id);
        setNotifications(notifs as Notification[]);
      }
    });
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
    await supabase.auth.signOut();
    profileLoaded.current = false;
    router.replace("/login");
  }

  async function handleNotifClick(n: Notification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
  }

  if (pathname === "/login") return <>{children}</>;

  if (WASHER_ROUTES.some((r) => pathname.startsWith(r)))
    return <LockedLayout label="Employee Portal" icon={UserCircle} name={userName} role="washer">{children}</LockedLayout>;

  if (STORE_ROUTES.some((r) => pathname.startsWith(r)))
    return <LockedLayout label="Store" icon={Store} name={userName} role="store keeper">{children}</LockedLayout>;

  const NAV = ALL_NAV.filter((n) => n.roles.includes(role));
  const unread = notifications.filter((n) => !n.read).length;

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {NAV.map((n) => {
        const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} onClick={onClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition group"
            style={{ background: active ? "var(--panel-2)" : "transparent", color: active ? "var(--accent)" : "var(--muted)" }}>
            <Icon size={17} />
            <span className="flex-1">{n.label}</span>
            {active && <ChevronRight size={14} className="opacity-50" />}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <aside className="w-64 shrink-0 hidden lg:flex flex-col border-r border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent)]">
            <Droplet size={18} className="text-white" />
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg leading-none text-[var(--text)]">WashOS</p>
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--muted)]">Car Wash ERP</p>
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          <NavLinks />
        </nav>
        <div className="pt-4 border-t border-[var(--line)]">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--muted)] hover:text-[var(--red)] transition">
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] flex flex-col bg-[var(--panel)] p-5 z-50 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent)]">
                  <Droplet size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg leading-none text-[var(--text)]">WashOS</p>
                  <p className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--muted)]">Car Wash ERP</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-[var(--muted)] hover:text-[var(--text)] p-1">
                <X size={20} />
              </button>
            </div>
            <nav className="space-y-1 flex-1 overflow-y-auto">
              <NavLinks onClick={() => setDrawerOpen(false)} />
            </nav>
            <div className="pt-4 border-t border-[var(--line)]">
              <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--muted)] hover:text-[var(--red)] transition">
                <LogOut size={17} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--line)] sticky top-0 z-10 backdrop-blur bg-[var(--panel)]/90">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} className="lg:hidden rounded-xl p-2.5 bg-[var(--panel-2)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]">
              <Menu size={17} />
            </button>
            <h2 className="font-[family-name:var(--font-display)] text-lg sm:text-xl capitalize text-[var(--text)]">
              {NAV.find((n) => n.href === pathname || (n.href !== "/" && pathname.startsWith(n.href)))?.label ?? "WashOS"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotif((s) => !s)}
                className="relative rounded-xl p-2.5 bg-[var(--panel-2)] border border-[var(--line)] hover:border-[var(--accent)] transition">
                <Bell size={17} className="text-[var(--muted)]" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--red)] text-[10px] flex items-center justify-center font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-12 w-72 sm:w-80 rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
                    <p className="font-[family-name:var(--font-display)] text-sm text-[var(--text)]">Notifications</p>
                    <button onClick={() => setShowNotif(false)} className="text-[var(--muted)] hover:text-[var(--text)]"><X size={15} /></button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--line)]">
                    {notifications.length === 0 && (
                      <p className="px-4 py-6 text-sm text-[var(--muted)] text-center">No notifications yet.</p>
                    )}
                    {notifications.map((n) => (
                      <button key={n.id} onClick={() => handleNotifClick(n)}
                        className="w-full text-left px-4 py-3 hover:bg-[var(--panel-2)] transition"
                        style={{ opacity: n.read ? 0.5 : 1 }}>
                        <p className="text-xs text-[var(--text)]">{n.message}</p>
                        <p className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)] mt-0.5">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-[var(--text)]">{userName}</p>
              <p className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--muted)] capitalize">{role.replace("_", " ")}</p>
            </div>
            <div className="w-9 h-9 rounded-full font-[family-name:var(--font-display)] flex items-center justify-center text-sm bg-[var(--accent)] text-white">
              {userInitials}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 flex-1 overflow-y-auto pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav — scrollable so all items are reachable */}
      <div className="mobile-nav lg:hidden fixed bottom-0 left-0 right-0 border-t border-[var(--line)] bg-[var(--panel)] z-20">
        <div className="flex overflow-x-auto scrollbar-none px-2 pt-2 gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl shrink-0"
                style={{ color: active ? "var(--accent)" : "var(--muted)" }}>
                <Icon size={20} />
                <span className="text-[9px] font-medium whitespace-nowrap">{n.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
