import { ToastProvider } from "@/providers/toast-provider";
import "./globals.css";
import { Inter } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import { ClerkProvider } from "@clerk/nextjs";
import { NetworkHealthWatcher } from "@/components/system/NetworkHealthWatcher";
import { NetworkAccessibilityAnnouncer } from "@/components/system/NetworkAccessibilityAnnouncer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport = {
  themeColor: "#0B1020",
};

export const metadata = {
  title: "EduSentrix",
  description: "Modern school management & payments",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ClerkProvider>
          <NetworkHealthWatcher />
          <NetworkAccessibilityAnnouncer />
          <ToastProvider />
          <AppProviders>{children}</AppProviders>
        </ClerkProvider>
      </body>
    </html>
  );
}
