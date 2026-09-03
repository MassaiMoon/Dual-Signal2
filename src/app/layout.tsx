import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DUAL // SIGNAL',
  description: 'Community identity badge system on DUAL Network',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'monospace', background: '#002433', color: '#F4FAF9' }}>
        {children}
      </body>
    </html>
  );
}
