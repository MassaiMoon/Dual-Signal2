export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1 style={{ color: '#5ED3EA', letterSpacing: '0.1em' }}>DUAL // SIGNAL</h1>
      <p>Community identity badge system — prototype v0.1</p>
      <ul style={{ lineHeight: 2 }}>
        <li><a href="/api/badges/" style={{ color: '#159DB8' }}>GET /api/badges/:id</a> — read badge state</li>
        <li><code style={{ color: '#9FE1CB' }}>POST /api/webhooks/test</code> — simulate an event (Phase A)</li>
        <li><code style={{ color: '#9FE1CB' }}>POST /api/admin/simulate-event</code> — admin shortcut</li>
      </ul>
    </main>
  );
}
