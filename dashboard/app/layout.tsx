import type { Metadata } from "next";
import "./globals.css";
import AppLayout from "@/components/AppLayout";
import SmoothScroll from "@/components/SmoothScroll";
import { UserProvider } from "@/lib/userContext";

export const metadata: Metadata = {
  title: "NetWatch // SOC Intrusion Detection Console",
  description:
    "Real-time ML-based network intrusion detection with explainable alerts for security operations teams. Zero automated blocking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <SmoothScroll>
          <UserProvider>
            <AppLayout>{children}</AppLayout>
          </UserProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
