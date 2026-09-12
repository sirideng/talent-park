import type { Metadata, Viewport } from 'next';
import './globals.css';
import './shared/presentation.css';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: '深圳成长记忆 · 一颗可以回去的星球',
  description:
    '在微缩深圳散步、骑行、看日落与城市灯火，重访属于自己的成长记忆。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
