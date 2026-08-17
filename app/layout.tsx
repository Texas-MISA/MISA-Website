import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// The design handoff's type pairing: Barlow Condensed for headings, Barlow for
// body. Italic 400 is loaded for the homepage tagline, which is the only
// italic on the site.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "TEXAS MISA",
    template: "%s — TEXAS MISA",
  },
  description:
    "Management Information Systems Association at The University of Texas at Austin — where analytics, innovation, and leadership converge.",
};

// 🪤 **`themeColor` belongs in the `viewport` export, NOT in `metadata`** — and
// putting it in the wrong one fails silently in the only way that matters: the
// build prints "Unsupported metadata themeColor is configured in metadata
// export" once per route, emits no `<meta name="theme-color">` at all, and
// still succeeds. It shipped that way once. Confirm with
// `curl … | grep theme-color`, not by reading the source.
//
// Paper, matching the page ground rather than the navy hero: mobile browsers
// tint their own chrome with this, and a navy bar above a white page reads as
// the header having come loose. One value, because there is one scheme — see
// DESIGN.md, *Light only*.
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
      // The inline script below sets a class on this element before React
      // hydrates, so the DOM and the RSC payload disagree by design.
      suppressHydrationWarning
    >
      <head>
        {/* 🪤 This one line is what makes the scroll reveal safe without
            JavaScript. globals.css hides `[data-reveal]` only under `html.js`,
            so a visitor with JS off never has anything hidden from them — and
            because the script runs synchronously during HTML parsing (the
            pattern in Next's "preventing flash before hydration" guide), the
            hidden state is in place before the first paint rather than after
            it, which is what would otherwise show the content and then blank
            it. Do not move this to a Client Component effect. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("js")`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
