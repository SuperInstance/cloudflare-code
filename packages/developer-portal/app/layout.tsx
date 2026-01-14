import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ClaudeFlare Developer Portal',
  description: 'Interactive API documentation, playground, and analytics for ClaudeFlare',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
