// Navigation fallback for every admin route (Stage 8 phase 3).
//
// 🪤 Two things about this file are counter-intuitive and both are deliberate.
//
// 1. There is NO per-widget <Suspense> anywhere to go with it, and adding some
//    would make things worse rather than better. The prerenderer walks up the
//    tree for the nearest Suspense boundary and stops at the first one it
//    finds; a loading.js high in the tree IS one, so granular boundaries below
//    it get masked by this full-page skeleton. One strategy per route, and this
//    is the one — it is prefetched as an instant navigation fallback and covers
//    every admin screen, where the dashboard's two widgets were never the
//    bottleneck.
//
// 2. It converts a `notFound()` 404 into a 200. Streaming commits to 200 OK the
//    moment a fallback renders, and the status cannot change afterwards; Next
//    injects <meta name="robots" content="noindex"> into the streamed HTML
//    instead. Our six detail pages all `await` their query before calling
//    notFound(), so they will stream and they will be 200s.
//
//    Accepted knowingly: every admin route already carries robots noindex from
//    app/admin/(shell)/layout.tsx, nothing consumes these as an API, and the
//    officer-visible behaviour is identical. The documented alternative — a
//    fast existence check above every await — buys a status code nothing reads,
//    at the cost of a second round trip on every page load.
//
// ⚠️ It cannot cover the shell layout's own requireOfficer(): loading.js sits
// BELOW layout.js, so with Cache Components off (this project) navigation
// simply blocks until that call finishes and this never renders. Moving auth
// out of the layout is not an option — it is the authorization boundary.

export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {/* Sized to the heading every admin page opens with, so the swap does not
          shift the page under the officer's cursor. */}
      <div className="h-9 w-64 bg-black/10" />
      <div className="mt-4 h-4 w-full max-w-2xl bg-black/5" />
      <div className="mt-2 h-4 w-3/4 max-w-xl bg-black/5" />

      <div className="mt-10 space-y-2">
        <div className="h-10 w-full bg-black/10" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 w-full bg-black/5" />
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
