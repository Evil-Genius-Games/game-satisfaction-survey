'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Something went wrong!</h2>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginTop: '1rem'
        }}
      >
        Try again
      </button>
    </div>
  );
}

