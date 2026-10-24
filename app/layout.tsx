import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./embedded-fonts.css";
import "./publication.css";
import "./journal-reading.css";

export const metadata: Metadata = {
  title: { default: "Wayne · 个人网站", template: "%s · Wayne" },
  description: "Wayne 的个人网站，记录学习、编程与项目。",
  icons: {
    icon: { url: "/favicon.svg?v=2", type: "image/svg+xml" },
    shortcut: "/favicon.svg?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
