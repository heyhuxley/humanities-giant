import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
  axes: ["opsz"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Who Wants to Be a Humanities Giant",
  description: "Join a live humanities quiz or sign in to host a session.",
};

// Browser theme metadata cannot resolve the ink CSS token.
export const viewport: Viewport = {
  themeColor: "#12100E",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-ember focus:px-4 focus:py-3 focus:font-semibold focus:text-ink focus:outline-none focus:ring-2 focus:ring-bone"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
