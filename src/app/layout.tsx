import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

import { BuildVersionBadge } from "@/components/build-version-badge";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { QueryProvider } from "@/components/providers";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider, themeBootScript } from "@/components/theme-provider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GradApply — Graduate applications, organized",
  description:
    "The calm command center for grad school: track programs and deadlines, draft professor outreach, version your SOP and CV, and use AI as an editor — not a replacement for your voice.",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        {/* Theme boot script — sets .dark before paint to avoid FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <SessionProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </SessionProvider>
          </QueryProvider>
          <BuildVersionBadge />
        </ThemeProvider>
      </body>
    </html>
  );
}
