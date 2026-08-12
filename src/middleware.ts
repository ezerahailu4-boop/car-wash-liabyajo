import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC: string[] = ["/login", "/reset-password"];

// What each role is allowed to access
const ROLE_HOME: Record<string, string> = {
  administrator: "/",
  manager: "/",
  store_keeper: "/store",
  washer: "/portal",
};

const ROLE_ALLOWED: Record<string, string[]> = {
  administrator: ["/", "/wash", "/inventory", "/requests", "/employees", "/customers", "/expenses", "/reports", "/store", "/portal", "/admin"],
  manager: ["/", "/wash", "/inventory", "/requests", "/employees", "/customers", "/expenses", "/reports"],
  store_keeper: ["/store"],
  washer: ["/portal"],
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (PUBLIC.includes(pathname)) return response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → send to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "washer";
  const allowed = ROLE_ALLOWED[role] ?? ["/portal"];

  const isAllowed = allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isAllowed) {
    const home = ROLE_HOME[role] ?? "/portal";
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
