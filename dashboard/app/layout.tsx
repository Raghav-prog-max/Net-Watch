import type { Metadata } from "next";
import "./globals.css";
import "lenis/dist/lenis.css";
import AppLayout from "@/components/AppLayout";
import SmoothScroll from "@/components/SmoothScroll";

export const metadata: Metadata = {
  title: "NetWatch // SOC Intrusion Detection Console",
  description:
    "Real-time ML-based network intrusion detection with explainable alerts for security operations teams. Zero automated blocking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body>
        <SmoothScroll>
          <AppLayout>{children}</AppLayout>
        </SmoothScroll>
      </body>
    </html>
  );
}
