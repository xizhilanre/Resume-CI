import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resume CI — AI 求职工作台',
  description: '从 JD 到一页 PDF，AI 驱动的全链路求职工具',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
