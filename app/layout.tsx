import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '人才公园 · 微缩漫游',
  description: '在深圳人才公园的微缩世界里散步，探索湖岸、桥梁与城市天际线。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
