import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Admin route protection (§5, §6). Next 16 renamed middleware.ts to proxy.ts
// and the exported function to proxy().
//
// This does TWO things, and the second is the one that matters:
//
//   1. An optimistic redirect — no session cookie at all means bounce to
//      /admin/login. Optimistic only: there is deliberately no database query
//      here, because proxy runs on prefetches too, and because Next's own docs
//      say proxy "should not be used as a full session management or
//      authorization solution". The real check (a matching admin_profiles row)
//      lives in lib/auth.ts and runs in the layout, every page, and every
//      Server Action.
//
//   2. Session refresh. This is the load-bearing part. lib/supabase/server.ts
//      swallows cookie writes, because cookies() is read-only during Server
//      Component rendering — so if an access token expired mid-render, GoTrue
//      would mint a rotated refresh token and we would drop it on the floor.
//      config.toml has enable_refresh_token_rotation with a 10s reuse
//      interval, so the browser then presents a consumed token and the whole
//      token family is revoked: the officer is signed out mid-edit, an hour
//      after logging in, for no visible reason. Refreshing here, where cookie
//      writes persist, is what prevents that.
//
// Divergence from §5, which says proxy checks the session *and* the
// admin_profiles row: the profile lookup is a database query and does not
// belong here. See lib/auth.ts.

export async function proxy(request: NextRequest) {
  // NextResponse.next({ request }) — not { request: { headers } }. The former
  // makes the mutated request visible to the render downstream; the latter
  // leaks headers to the client.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Two-phase copy. Phase one puts the refreshed token on the request
          // so the render that follows sees it; phase two puts it on the
          // response so the browser stores it. Skipping either half means the
          // refresh silently doesn't stick.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This call is what triggers the refresh. Removing it — or short-circuiting
  // before it on some path — disables session refresh with no error anywhere.
  // getUser() and not getSession(): the cookie is attacker-controllable, and
  // only getUser() validates the token against the Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return withRefreshedCookies(NextResponse.redirect(url), response);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return withRefreshedCookies(NextResponse.redirect(url), response);
  }

  // Return the mutated response, never a fresh NextResponse.next() — losing
  // this variable throws away the refreshed cookies just as surely as not
  // refreshing at all.
  return response;
}

/**
 * Carry any cookies GoTrue just rotated onto a redirect. Without this the
 * token is refreshed and then immediately discarded, which reads as a random
 * sign-out on whichever request happened to hit a redirect branch.
 */
function withRefreshedCookies(
  redirect: NextResponse,
  source: NextResponse
): NextResponse {
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Server Actions POST to the route they are rendered on, so this matcher
  // covers admin action submissions too. That is a convenience, not the
  // authorization boundary — every action re-checks via lib/auth.ts, because
  // a matcher change or a moved action would otherwise silently drop coverage.
  matcher: ["/admin/:path*"],
};
