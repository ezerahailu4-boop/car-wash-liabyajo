import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC: string[] = ["/login", "/reset-password", "/api/setup-sql"];

const ROLE_HOME: Record<string, string> = {
  administrator: "/",
  manager: "/",
  store_keeper: "/store",
  washer: "/portal",
};

const ROLE_ALLOWED: Record<string, string[]> = {
  administrator: [
    "/",
    "/wash",
    "/inventory",
    "/requests",
    "/employees",
    "/customers",
    "/expenses",
    "/reports",
    "/store",
    "/portal",
    "/admin",
  ],
  manager: ["/", "/wash", "/inventory", "/requests", "/employees", "/customers", "/expenses", "/reports"],
  store_keeper: ["/store"],
  washer: ["/portal"],
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (PUBLIC.includes(pathname) || pathname.startsWith("/api")) return response;

  // 1. Check local session cookie first (for instant fast login)
  const roleCookie = request.cookies.get("washos_role")?.value;
  const sessionCookie = request.cookies.get("washos_session")?.value;

  let activeRole = roleCookie;
  if (!activeRole && sessionCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sessionCookie));
      activeRole = parsed.role;
    } catch { /* ignore */ }
  }

  // 2. If no local session cookie, check Supabase Auth
  if (!activeRole && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
              response = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        activeRole = profile?.role ?? "washer";
      }
    } catch { /* ignore network error */ }
  }

  // If still no authenticated role, redirect to login
  if (!activeRole) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Check role authorization for current path
  const allowed = ROLE_ALLOWED[activeRole] ?? ["/portal"];
  const isAllowed = allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isAllowed) {
    const home = ROLE_HOME[activeRole] ?? "/portal";
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
