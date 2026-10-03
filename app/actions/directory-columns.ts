"use server";

import { cookies } from "next/headers";

import { getOfficer } from "@/lib/auth";
import {
  canonicalDirectoryColumns,
  directoryColumnsCookieWrite,
} from "@/lib/directory-columns";

// Remembers an officer's directory columns on their browser (doc v1.82): the
// Fields menu on /admin/members calls this, and the page reads the cookie it
// sets. The rules — the format, the delta, what counts as the defaults — are
// lib/directory-columns.ts's; this file is only the wiring.
//
// 🔓 **The cookie is set HERE, as an HTTP `Set-Cookie`, and never by script.**
// The first build wrote it from the toolbar with `document.cookie`, and WebKit's
// tracking prevention caps a script-written cookie at seven days — Safari and
// every browser on iOS — with Brave doing the same. A year-long preference that
// lasts a week is a feature that works on the officer's laptop and not on
// their phone. A cookie from an HTTP response keeps its Max-Age, and it can be
// HttpOnly, because no script reads it.
//
// ⚠️ **No `admin_audit` row, and that is a decision rather than an omission.**
// Every officer mutation writes one because it changes CLUB data — a member, an
// event, a point, a payment. This changes none. It is a display preference,
// stored in the officer's own browser and not in the database: it moves no
// record, grants nothing, and is invisible to every other officer. What it
// shapes that matters — the columns of an export — is audited where it leaves:
// the export route takes its columns from the URL alone, never from this
// cookie, and its `roster.exported` receipt records the fields that actually
// left.
//
// Opens with getOfficer() and returns `unauthorized`, like every action here.
// Never requireOfficer(): its redirect() throws NEXT_REDIRECT, and an action's
// caller gets an exception where it expected a result.
//
// 📌 **No router.refresh() is needed after this.** Setting or deleting a cookie
// in a Server Action makes Next re-render the current page in the SAME
// response (node_modules/next/dist/docs/01-app/01-getting-started/
// 07-mutating-data.md, "Cookies"; and 02-guides/server-actions.md). Checked in
// the installed source too: a cookie write marks the path revalidated
// (server/web/spec-extension/adapters/request-cookies.js), so the action
// handler does not skip the render, and the client router applies it as a
// seeded navigation with no second request
// (client/components/router-reducer/reducers/server-action-reducer.js).

export type RememberDirectoryColumnsResult =
  | { status: "saved" }
  | { status: "unauthorized" }
  /** Not a value the page would read back as a choice: garbage, the wrong
   * type, or longer than the page reads. Nothing was written. */
  | { status: "invalid" };

/**
 * Remember these columns on this browser: `value` is a cookie value from
 * `serializeDirectoryColumns`, or null to forget the choice entirely.
 *
 * 🔓 The argument comes from the browser, so it is canonicalised, never
 * stored as sent. Keys are not checked against the field catalogue: the page
 * resolves them on read, and a key for a field that is archived today must
 * survive to be honoured once it is back.
 */
export async function rememberDirectoryColumns(
  value: string | null
): Promise<RememberDirectoryColumnsResult> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const canonical = canonicalDirectoryColumns(value);
  if (canonical.kind === "invalid") return { status: "invalid" };

  // A null value DELETES, on the same Path the cookie was set on — see
  // directoryColumnsCookieWrite for why that is a `set`, not `delete()`.
  (await cookies()).set(directoryColumnsCookieWrite(canonical.value));
  return { status: "saved" };
}
