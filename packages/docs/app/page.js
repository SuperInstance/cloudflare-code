export default function Index() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem' }}>
        Welcome to ClaudeFlare Docs
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#666', maxWidth: '600px', marginBottom: '2rem' }}>
        The comprehensive developer portal for ClaudeFlare - a distributed AI coding platform on Cloudflare Workers.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <a
          href="/docs/getting-started/introduction"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0ea5e9',
            color: 'white',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          Get Started
        </a>
        <a
          href="/docs/api-reference/overview"
          style={{
            padding: '0.75rem 1.5rem',
            border: '2px solid #0ea5e9',
            color: '#0ea5e9',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          View API Reference
        </a>
      </div>
    </div>
  )
}
