import type { Metadata } from "next";
import { Poppins, Roboto_Slab } from "next/font/google";
import "./globals.css";

// Approximations of the existing txmisa.org type pairing (see
// docs/existing-site-inventory.md): heavy slab serif display + geometric sans.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "TEXAS MISA",
    template: "%s — TEXAS MISA",
  },
  description:
    "Management Information Systems Association at The University of Texas at Austin — where analytics, innovation, and leadership converge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${robotoSlab.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
