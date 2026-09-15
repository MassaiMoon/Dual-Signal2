'use client';

import { useState } from 'react';

interface Props {
  url:   string;
  label: string;
}

export function ShareButton({ url, label }: Props) {
  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: label, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
  }

  return (
    <button
      onClick={handleShare}
      style={{
        width:         '100%',
        padding:       '15px 24px',
        background:    '#0EB4D0',
        border:        'none',
        borderRadius:  12,
        color:         '#fff',
        fontSize:      13,
        fontWeight:    700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        cursor:        'pointer',
        transition:    'background 0.15s, box-shadow 0.15s',
        boxShadow:     '0 4px 20px rgba(14,180,208,0.2)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(14,180,208,0.9)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(14,180,208,0.35)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = '#0EB4D0';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(14,180,208,0.2)';
      }}
    >
      ↗ &nbsp; Share Badge
    </button>
  );
}

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        width:         '100%',
        padding:       '12px 24px',
        background:    'rgba(94,211,234,0.05)',
        border:        '1px solid rgba(94,211,234,0.14)',
        borderRadius:  12,
        color:         '#5ED3EA',
        fontSize:      11,
        fontWeight:    600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        cursor:        'pointer',
        transition:    'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(94,211,234,0.08)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(94,211,234,0.3)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(94,211,234,0.05)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(94,211,234,0.14)';
      }}
    >
      {copied ? '✓  Copied' : 'Copy Link'}
    </button>
  );
}

export default ShareButton;
