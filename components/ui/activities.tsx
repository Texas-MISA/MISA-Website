import { Hatch } from "@/components/ui/hatch";
import { Title } from "@/components/ui/heading";
import { ACTIVITIES } from "@/lib/site";

// The four alternating "what we do" rows on the home page — the Stage 2
// four-up pillar grid, restated as full-width rows.
//
// 📌 No numerals. The 01–04 labels were in an earlier round and the handoff
// removed them deliberately; don't put them back.
//
// The copy side leads on odd rows and follows on even ones, and each row slides
// in from its own side. `order` rather than two branches of markup, so the
// reading order stays copy-then-photo for a screen reader on every row.
//
// 📌 Now returns a real element rather than a fragment, so the caller can place
// it. It used to be a bare list of siblings, which meant the home page had to
// wrap it in a second <section> purely to give it a gutter — and that extra
// wrapper is what split the "Activities" heading away from the rows it titles.
//
// 🪤 The `revealDelay(0)` each row carried has gone. A zero-second stagger is
// not a stagger, and the rows are a full viewport apart in any case: each one
// enters on its own intersection, so a delay would only make it late.

export function Activities({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      {ACTIVITIES.map((activity, i) => {
        const photoFirst = i % 2 === 1;
        return (
          <div
            key={activity.title}
            data-reveal={photoFirst ? "right" : "left"}
            className="grid items-center gap-10 border-t border-misa-hairline py-9 last:border-b md:grid-cols-2"
          >
            <div>
              <Title className="mb-2.5">{activity.title}</Title>
              <p className="max-w-[46ch] leading-[1.65] text-misa-secondary">
                {activity.body}
              </p>
            </div>
            <Hatch
              caption={activity.caption}
              className={`aspect-16/10 border border-misa-border ${
                photoFirst ? "md:order-first" : ""
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
