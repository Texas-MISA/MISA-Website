import { Hatch } from "@/components/ui/hatch";
import { revealDelay } from "@/components/ui/reveal";
import { ACTIVITIES } from "@/lib/site";

// The four alternating "what we do" rows on the home page — the Stage 2
// four-up pillar grid, restated as full-width rows.
//
// 📌 No numerals. The 01–04 labels were in an earlier round and the handoff
// removed them deliberately; don't put them back.
//
// The copy side leads on odd rows and follows on even ones, and each row
// slides in from its own side. `order` rather than two branches of markup, so
// the reading order stays copy-then-photo for a screen reader on every row.
export function Activities() {
  return (
    <>
      {ACTIVITIES.map((activity, i) => {
        const photoFirst = i % 2 === 1;
        return (
          <div
            key={activity.title}
            data-reveal={photoFirst ? "right" : "left"}
            style={revealDelay(0)}
            className="grid items-center gap-10 border-t border-misa-hairline py-9 last:border-b md:grid-cols-2"
          >
            <div>
              <h3 className="mb-2.5 font-display text-[26px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
                {activity.title}
              </h3>
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
    </>
  );
}
