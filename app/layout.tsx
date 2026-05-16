import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "수능 분석기",
  description: "수능 모의고사 오답 노트 & 점수 추이 분석",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body
        className="flex min-h-full"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </body>
    </html>
  );
}
