"use client";

import { useActionState } from "react";

import {
  restoreOfficerAccess,
  revokeInvite,
  revokeOfficerAccess,
  type InviteRevokeState,
  type OfficerAccessState,
} from "@/app/actions/invites";

// The per-row controls on /admin/officers. Three small forms, each with its own
// useActionState, because each posts a different action for a different row.
//
// ⚠️ These are one-click destructive-ish actions with no confirmation dialog,
// which matches the rest of this admin section (voiding, archiving, rejecting) —
// and it is safe for the same reason: nothing here destroys data. Revoking
// removes an admin_profiles row and keeps the account, every action writes an
// audit row, and the inverse of each is one click away on this same screen.

const ACCESS_INITIAL: OfficerAccessState = { status: "idle" };
const INVITE_INITIAL: InviteRevokeState = { status: "idle" };

const dangerButton =
  "rounded-full border border-red-800 px-4 py-1.5 text-xs font-medium tracking-wider text-red-900 transition hover:bg-red-50 disabled:opacity-60";

const plainButton =
  "rounded-full border border-black/70 px-4 py-1.5 text-xs font-medium tracking-wider transition hover:bg-black/5 disabled:opacity-60";

const selectClass = "border border-black/70 bg-misa-panel px-2 py-1.5 text-xs";

export function RevokeAccessButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    revokeOfficerAccess,
    ACCESS_INITIAL
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <ActionMessage state={state} />
      <button type="submit" disabled={pending} className={dangerButton}>
        {pending ? "Removing…" : "Remove access"}
      </button>
      <span className="sr-only">for {label}</span>
    </form>
  );
}

export function RestoreAccessButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    restoreOfficerAccess,
    ACCESS_INITIAL
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <ActionMessage state={state} />
      {/* The prior role does not survive a revoke — that row was deleted — so
          the granting officer says what they mean rather than inheriting a
          privilege nobody chose. */}
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Access level for {label}
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue="officer"
        className={selectClass}
      >
        <option value="officer">Officer</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" disabled={pending} className={plainButton}>
        {pending ? "Granting…" : "Give access"}
      </button>
    </form>
  );
}

export function RevokeInviteButton({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    revokeInvite,
    INVITE_INITIAL
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      {state.status === "already_gone" ? (
        <span role="status" className="text-xs text-foreground/70">
          Already gone
        </span>
      ) : null}
      {state.status === "error" || state.status === "unauthorized" ? (
        <span role="alert" className="text-xs text-red-800">
          Couldn&apos;t withdraw it
        </span>
      ) : null}
      <button type="submit" disabled={pending} className={dangerButton}>
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
      <span className="sr-only">the invitation for {email}</span>
    </form>
  );
}

/**
 * The states worth surfacing next to the button.
 *
 * `done` is deliberately silent: the page revalidates and the row moves to the
 * other list, which is a clearer confirmation than a message attached to a
 * control that has just disappeared.
 */
function ActionMessage({ state }: { state: OfficerAccessState }) {
  switch (state.status) {
    case "self":
      return (
        <span role="alert" className="text-xs text-red-800">
          You can&apos;t remove your own access
        </span>
      );
    case "no_change":
      return (
        <span role="status" className="text-xs text-foreground/70">
          Nothing to change
        </span>
      );
    case "unauthorized":
      return (
        <span role="alert" className="text-xs text-red-800">
          Session expired
        </span>
      );
    case "error":
      return (
        <span role="alert" className="text-xs text-red-800">
          That didn&apos;t work
        </span>
      );
    default:
      return null;
  }
}
