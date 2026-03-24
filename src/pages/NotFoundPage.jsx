export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)',
      gap: 16, textAlign: 'center', padding: '2rem'
    }}>
      <div style={{ fontSize: 64, lineHeight: 1 }}>🔍</div>
      <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 320 }}>
        The page you're looking for doesn't exist. Head back to your dashboard.
      </p>
      <a href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
        Go to Dashboard
      </a>
    </div>
  )
}
