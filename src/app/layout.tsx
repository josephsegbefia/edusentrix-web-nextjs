import { ToastProvider } from "@/providers/toast-provider";
import "./globals.css";
import { Inter } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
// import { AppProviders } from "@/providers/app-providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "EduSentrix",
  description: "Modern school management & payments",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ToastProvider />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
