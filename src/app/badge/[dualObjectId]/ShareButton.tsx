'use client';

import { useState } from 'react';

interface Props {
  url:   string;
  label: string;
}

export default function ShareButton({ url, label }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: label, url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      style={{
        width:           '100%',
        padding:         '14px 24px',
        background:      copied ? 'rgba(94,211,234,0.15)' : 'rgba(94,211,234,0.08)',
        border:          '1px solid rgba(94,211,234,0.3)',
        borderRadius:    10,
        color:           '#5ED3EA',
        fontSize:        13,
        fontWeight:      600,
        letterSpacing:   3,
        textTransform:   'uppercase',
        cursor:          'pointer',
        transition:      'background 0.2s, border-color 0.2s',
      }}
    >
      {copied ? '✓  Link Copied' : '↗  Share Badge'}
    </button>
  );
}
