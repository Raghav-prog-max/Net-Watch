import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetWatch",
  description: "ML intrusion detection alerts for the SOC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <strong>NetWatch</strong>
          <nav>
            <Link href="/">Live alerts</Link>
            <Link href="/evaluation">Evaluation</Link>
            <Link href="/drift">Drift</Link>
            <Link href="/models">Models</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
