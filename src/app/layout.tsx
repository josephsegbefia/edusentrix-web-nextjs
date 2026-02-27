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
    icon: "/logo/edusentrix-logo.png",
    apple: "/logo/edusentrix-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body>
          <NetworkHealthWatcher />
          <NetworkAccessibilityAnnouncer />
          <ToastProvider />
          <AppProviders>{children}</AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
