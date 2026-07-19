import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dead Drop — Syndicate Protocol",
  description:
    "Wire-tap gamble mini-game. Stake in-game Tokens for a chance at in-game SYNX.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#070605] font-sans text-stone-200 antialiased">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,53,15,0.18),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(68,64,60,0.25),transparent_30%)]" />
        <main className="relative flex-1">{children}</main>
      </body>
    </html>
  );
}
