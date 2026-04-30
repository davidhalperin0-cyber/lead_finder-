import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="he" dir="rtl">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
