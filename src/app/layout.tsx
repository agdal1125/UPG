import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'UPG - Ultimate Prompt Ground',
  description: 'LLM Prompt Comparison Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
