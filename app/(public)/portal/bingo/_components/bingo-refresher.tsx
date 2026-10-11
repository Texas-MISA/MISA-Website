"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps /portal/bingo live: officers record proof in /admin, and an open page
// shows it within about REFRESH_MS. Polling, not Supabase Realtime
// (docs/member-portal-plan.md): router.refresh() re-renders the page's Server
// Components, so every read stays on the server with the service role and no
// table needs an anon grant. Renders nothing.
//
// 📌 Only while the tab is VISIBLE. A hidden tab polls nothing, and the moment
// it is shown again it refreshes once and restarts the clock, so a member
// switching back sees the board as it is now rather than up to ten seconds
// stale.
//
// 🪤 Never while a proof dialog is open. A refresh re-renders the tile that
// owns the dialog, and the member may be watching its video; the board can
// wait for the next tick.
//
// 🪤 Never while the browser says it is offline. A refresh whose fetch fails is
// not a quiet no-op in Next 16: the router falls back to a full browser reload
// of the page (ppr-navigations.js: "we fall back to the browser behavior for
// offline navigations"), which with no connection is the browser's offline
// error page, in place of a board the member was reading.

/** How often an open, visible page re-reads the board. */
const REFRESH_MS = 10_000;

/** A proof dialog that is showing. proof-tile.tsx marks each one. */
const OPEN_PROOF = "dialog[data-bingo-proof][open]";

export function BingoRefresher() {
  const router = useRouter();

  useEffect(() => {
    let timer: number | undefined;

    function refresh() {
      if (document.visibilityState !== "visible") return;
      if (!navigator.onLine) return;
      if (document.querySelector(OPEN_PROOF) !== null) return;
      router.refresh();
    }

    function start() {
      window.clearInterval(timer);
      timer = window.setInterval(refresh, REFRESH_MS);
    }

    function stop() {
      window.clearInterval(timer);
      timer = undefined;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
