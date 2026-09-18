import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { AppFooter } from "@/components/layout/app-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aitvaras",
  description: "Aitvaras — būsimoji Alfasis sandėlio aplikacija.",
  icons: {
    // Dedicated light-background favicon so the mark stays visible in both
    // light and dark browser chrome. The in-app UI keeps the symbol/horizontal
    // logo assets. See docs/branding.md.
    icon: "/brand/aitvaras-logo-favicon.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="lt">
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <AuthProvider>
          <div className="flex flex-1 flex-col">{children}</div>
          <AppFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
