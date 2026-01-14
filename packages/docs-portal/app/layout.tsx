import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { DocsNav } from '@/components/navigation/DocsNav';

// ============================================================================
// Fonts
// ============================================================================

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'ClaudeFlare Documentation - Distributed AI Coding Platform',
  description: 'Complete documentation for ClaudeFlare, the distributed AI coding platform built on Cloudflare Workers.',
  keywords: ['ClaudeFlare', 'Cloudflare Workers', 'AI', 'documentation', 'API'],
  authors: [{ name: 'ClaudeFlare Team' }],
  openGraph: {
    title: 'ClaudeFlare Documentation',
    description: 'Complete documentation for ClaudeFlare',
    type: 'website',
    url: 'https://docs.claudeflare.com',
    siteName: 'ClaudeFlare Docs',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ClaudeFlare Documentation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClaudeFlare Documentation',
    description: 'Complete documentation for ClaudeFlare',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ============================================================================
// Root Layout
// ============================================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <div className="flex min-h-screen">
          {/* Sidebar Navigation */}
          <DocsNav />

          {/* Main Content */}
          <main className="flex-1 lg:ml-64">
            {children}
          </main>
        </div>

        {/* TOC Container (populated by individual pages) */}
        <div id="toc-container" />
      </body>
    </html>
  );
}
