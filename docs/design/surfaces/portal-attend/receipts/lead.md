---
skill: impeccable
command: /impeccable polish app/(public)/portal/attend/
date: 2026-09-19
commit: "a38a2b3d3fb740cc9565fdfb2036dfee72449efb"
output: lead.output.md
findings:
  - id: L1
    summary: "The outcome heading is set in the PARAGRAPH ink. `ResultPanel`'s `<Title>` sits inside `Banner`, whose tone classes end in `text-misa-body`, so the `<h2>` computes rgb(58,61,64) — Body Graphite, which DESIGN.md §Colors assigns to \"long-form paragraphs\" — while the review step's heading two screens earlier inherits `body`'s `--foreground` and is Graphite. Same component, same size, same role, two inks in one flow."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: L2
    summary: "16px body copy carries `leading-[1.65]`, which is the ramp's `Lead` row (18px). DESIGN.md §The ramp puts Body at 16 / 1.6. Ten call sites in the codebase pair 1.65 with body size and three use 1.6 — including `portal/page.tsx:188`, the hub, the only other surface through this pipeline, whose own gate chose 1.6 against the ramp."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: L3
    summary: "The box label and its reassurance are `text-sm` (14px), a size on no row of DESIGN.md §The ramp — the same finding the hub's own lead pass adopted (its `lead.md` L2)."
    disposition: rejected
    reason: "Re-derived against this surface and it does not hold here. (1) The hub's L2 was a standalone prose line; this is FORM vocabulary — `components/ui/field.tsx` sets every field label at `text-sm`, and the three labels directly above the box are 14px on this page, so raising the checkbox's label to 16px would make it larger than the labels it sits with, a worse hierarchy than the one being fixed. (2) Measured: at 16px the label and its two-line reassurance grow ~36px, putting the Check in button at ~647 on a 640 fold. EV5 names the reassurance as the thing that gives first under pressure; it does not license breaking the one number the surface is gated on. Recorded rather than dropped because parts 4 and 5 will ask the same question."
  - id: L4
    summary: "Optical alignment of the outcome mark: `size-6` at `mt-0.5` beside a 22px heading measures icon centre 649.1 against heading line-box centre 646.6 — 2.5px low on a 24px mark."
    disposition: rejected
    reason: "Measured and inside tolerance. Removing `mt-0.5` moves the centre to 647.1 and trades a 2.5px line-box offset for a cap-height one — a coin toss rather than an improvement, and craft-floor asks for optical alignment, not for a number to be driven to zero. Reported so the measurement is on the record."
---

The lead's own pass, `impeccable` in Operate mode against the craft floor. The
concept is not in question — the officer adopted concept A and it measured out,
the bar landing at **611 against a 640 fold** where the estimate was 628 with
12px of slack. Everything here is refinement inside it.

**Classification (`polish.md` §1).** L1 and L2 are *design-system drift*: an ink
used for a role the ramp assigns to a different token, and a leading value from
the wrong ramp row. Neither is a conceptual mismatch, which is what a polish
pass wants to find.

📌 **Two of the four findings were rejected, and both rejections are the
interesting half.** L3 is the hub's own adopted finding, re-derived here and
refused — the two surfaces disagree because one was measuring a prose line and
the other a form label, and the phase needs that written down before parts 4 and
5 ask again. L4 is a measurement that came back inside tolerance; reporting the
number is worth more than changing the code.

🪤 **Every figure in `lead.output.md` is `getComputedStyle` or
`getBoundingClientRect` on the running page, not a grep.** This project has a
live case (`activities.tsx:98`) where the rendered class attribute itself lies.
All twelve states were driven on the local stack — including `error`, by
revoking the check-in RPC's execute grant, and `rate_limited`, by filling the
throttle bucket. Both restored, and the stack was returned to its seed state
(208 attendance rows, 32 members, 0 events, 0 throttle rows).
