import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://second-player-lab.asterai.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'MCPilot Adaptive Interactive Play Lab',
  description: 'A playable accessibility lab where you and your agent tune the game together.',
  applicationName: 'MCPilot',
  openGraph: {
    title: 'MCPilot Adaptive Interactive Play Lab',
    description: 'A playable accessibility lab where you and your agent tune the game together.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MCPilot adaptive interactive play lab' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPilot Adaptive Interactive Play Lab',
    description: 'A playable accessibility lab where you and your agent tune the game together.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
