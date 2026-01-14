import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { useDashboardStore } from '@/lib/store';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClaudeFlare Dashboard',
  description: 'Distributed AI coding platform dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
