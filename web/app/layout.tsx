import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "Lead Finder CRM",
  description: "ניהול לידים — הכנה לשיחה אנושית בלבד",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
