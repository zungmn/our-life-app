import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "우리 집 | Eddy & Judy",
  description: "캘린더, 가계부, 독서노트, 감사일기",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">
        <Navigation />
        <main className="md:ml-56 pb-16 md:pb-0 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
