import Link from "next/link";

// The admin 404 (Stage 8 phase 3). The single highest-value file of the phase:
// it covers all six `notFound()` call sites at once — members/[id],
// events/[id], attendance/[id], dues/[id], points/[id] and
// members/fields/[id] — and renders INSIDE the shell, so an officer who
// followed a stale link keeps the nav and has a way back.
//
// Before this file, every one of those fell through to Next's built-in 404
// inside the root layout: no nav, no links, no indication which section they
// had been in. That matters more since the phase-8 merge tool can genuinely
// delete a member, so a bookmark going stale is an ordinary event rather than
// a typo.
//
// A Server Component and takes no props — `not-found.js` receives none.
//
// 📌 It renders between loading.js and page.js in the hierarchy, wrapped by
// both. Since `(shell)/loading.tsx` exists, the response has already committed
// to 200 by the time this renders; Next injects `<meta name="robots"
// content="noindex">` itself, and every admin route is noindex anyway. See the
// note in loading.tsx.

export default function AdminNotFound() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
        Not found
      </h1>
      <p className="mt-4 text-misa-body">
        That record doesn&apos;t exist. It may have been deleted, or merged into
        another one — a merged member&apos;s link stops working, and the merge is
        recorded against the member that survived.
      </p>
      <p className="mt-3 text-sm text-misa-secondary">
        If you followed a link from inside the admin section and expected
        something to be here, that is worth mentioning to another officer: it
        means a page is pointing at a record that is gone.
      </p>

      <nav aria-label="Admin sections" className="mt-8 flex flex-wrap gap-3">
        {[
          ["/admin", "Dashboard"],
          ["/admin/members", "Members"],
          ["/admin/events", "Events"],
          ["/admin/attendance", "Attendance"],
          ["/admin/points", "Points"],
          ["/admin/dues", "Dues"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="border border-misa-border px-3 py-1 text-xs font-semibold tracking-wider uppercase transition hover:bg-misa-panel"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
