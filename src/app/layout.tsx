import type { Metadata } from 'next';
import { Inter, Rajdhani } from 'next/font/google';
import './globals.css';

const inter    = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Rajdhani is the Passport card's typeface (components/PassportCard).
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-rajdhani', display: 'swap' });

export const metadata: Metadata = {
  title: 'DUAL // SIGNAL',
  description: 'Community identity badge system on DUAL Network',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable}`}>
      <body>{children}</body>
    </html>
  );
}
