'use client';

/**
 * /me — member dashboard. Loads the session's profile + activity and hands
 * them to <Dashboard>. Unauthenticated visitors are sent to /login.
 */

import { useState, useEffect, useCallback } from 'react';
import Dashboard, { type MeData, type ActivityItem, type BadgeData } from './Dashboard';

export default function MePage() {
  const [data,       setData]       = useState<MeData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [loadErr,    setLoadErr]    = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [actLoading, setActLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.ok) setData(await res.json());
      else setLoadErr(true);
    } catch { setLoadErr(true); }
    finally { setLoading(false); }
  }, []);

  const loadActivity = useCallback(async () => {
    setActLoading(true);
    try {
      const res = await fetch('/api/me/activity');
      if (res.ok) { const j = await res.json(); setActivities(j.activities ?? []); }
    } finally { setActLoading(false); }
  }, []);

  useEffect(() => { load(); },         [load]);
  useEffect(() => { loadActivity(); }, [loadActivity]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function updateHandle(source: string, badgeField: keyof BadgeData | null, val: string | null) {
    setData(prev => {
      if (!prev) return prev;
      const accounts = val
        ? prev.accounts.some(a => a.source === source)
          ? prev.accounts.map(a => a.source === source ? { ...a, handle: val } : a)
          : [...prev.accounts, { id: '', source, handle: val, externalUserId: val.toLowerCase(), xResolvedAt: null, requiresReview: false, verifiedAt: null }]
        : prev.accounts.filter(a => a.source !== source);
      const badge = prev.badge && badgeField ? { ...prev.badge, [badgeField]: val ?? '' } : prev.badge;
      return { ...prev, accounts, badge };
    });
  }

  if (loading) return <DashboardSkeleton />;

  if (loadErr || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="ds-card" style={{ textAlign: 'center', maxWidth: 400, padding: '36px 32px' }}>
          <p style={{ color: 'var(--ds-text-strong)', fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>Couldn’t load your dashboard</p>
          <p className="ds-body" style={{ marginBottom: 24 }}>There was a problem reaching the server. Check your connection and try again.</p>
          <button type="button" className="ds-btn ds-btn-primary" onClick={() => { setLoadErr(false); setLoading(true); load(); }}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      data={data}
      activities={activities}
      actLoading={actLoading}
      onUpdateHandle={updateHandle}
      onLogout={logout}
    />
  );
}

function DashboardSkeleton() {
  const block = (h: number | string, w: number | string = '100%', r = 12): React.CSSProperties => ({
    height: h, width: w, borderRadius: r, background: 'var(--ds-bg-raised)', animation: 'me-sk 1.4s ease-in-out infinite',
  });
  return (
    <div aria-busy="true" aria-label="Loading your dashboard" style={{ minHeight: '100vh' }}>
      <style>{`@keyframes me-sk { 0%,100% { opacity: .45 } 50% { opacity: .9 } }
        .me-sk-grid { display: grid; grid-template-columns: 1.45fr 1fr; gap: 20px; }
        .me-sk-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 44px; }
        @media (max-width: 900px) { .me-sk-grid { grid-template-columns: 1fr; } .me-sk-4 { grid-template-columns: 1fr 1fr; } }`}</style>
      <div className="ds-nav"><span className="ds-logo">DUAL <span>//</span> SIGNAL</span></div>
      <div className="ds-container" style={{ paddingTop: 104 }}>
        <div style={block(14, 90, 4)} />
        <div style={{ ...block(34, 'min(420px, 80%)', 8), marginTop: 12, marginBottom: 28 }} />
        <div className="me-sk-grid">
          <div style={{ ...block('auto'), aspectRatio: '3 / 2' }} />
          <div style={block(320, '100%', 16)} />
        </div>
        <div className="me-sk-4">{[0, 1, 2, 3].map(i => <div key={i} style={block(170, '100%', 16)} />)}</div>
      </div>
    </div>
  );
}
