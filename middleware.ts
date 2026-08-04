import { NextResponse, type NextRequest } from "next/server";

const DASHBOARD_COOKIE = "dashboard_access_token";

async function hasValidDashboardSession(request: NextRequest) {
  const token = request.cookies.get(DASHBOARD_COOKIE)?.value;
  if (!token) return false;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const valid = await hasValidDashboardSession(request);
    if (!valid) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.set(DASHBOARD_COOKIE, "", { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 0 });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
