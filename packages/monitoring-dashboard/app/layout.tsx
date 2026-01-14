import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { RealTimeProvider } from '@/contexts/RealTimeContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClaudeFlare Monitoring Dashboard',
  description: 'Advanced monitoring dashboard system for ClaudeFlare platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RealTimeProvider url={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}>
          {children}
        </RealTimeProvider>
      </body>
    </html>
  );
}
