import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "micr-AI 文献摘取",
  description:
    "使用 AI 快速提取微生物学文献中的菌种、来源、抗药性等信息，支持结构化导出和上下文验证。",
  openGraph: {
    title: "micr-AI 文献摘取",
    description:
      "使用 AI 快速提取微生物学文献中的菌种、来源、抗药性等信息，支持结构化导出和上下文验证。",
    url: "https://micr-ai.local",
    siteName: "micr-AI",
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
