'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong!</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>{error?.message || 'An unexpected error occurred'}</p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Try again
      </button>
    </div>
  );
}

