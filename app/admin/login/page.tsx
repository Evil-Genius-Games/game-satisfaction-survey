'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type AuthMode = 'login' | 'register';

const allowedDomain = 'evilgeniusgaming.com';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const requestedNext = searchParams.get('next');

    if (requestedNext?.startsWith('/admin') && requestedNext !== '/admin/login') {
      return requestedNext;
    }

    return '/admin';
  }, [searchParams]);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === 'login';
  const title = isLogin ? 'Enter the Survey Manager' : 'Join the Control Room';
  const actionText = isLogin ? 'Launch dashboard' : 'Create secure account';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(`@${allowedDomain}`)) {
      setError('Use your Evil Genius Games email address to continue.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin-auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Unable to authenticate. Please try again.');
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError('Unable to reach the admin login service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-stage" aria-label="Evil Genius Survey Manager access">
        <div className="admin-login-hero">
          <div className="admin-login-logo-card">
            <img
              src="/brand/evil-genius-games-logo.webp"
              alt="Evil Genius Games"
              className="admin-login-logo"
              width={220}
              height={68}
              loading="eager"
              decoding="async"
            />
          </div>
          <p className="admin-login-kicker">Evil Genius Games</p>
          <h1>Evil Genius Survey Manager</h1>
          <p>
            Your secret lair for reading table feedback, tracking convention intel, and turning every session report into better adventures.
          </p>
          <div className="admin-login-mission-card" aria-label="Survey manager highlights">
            <span>Mission Control</span>
            <strong>Ratings, responses, GM interest, and coupon activity in one secure dashboard.</strong>
          </div>
        </div>

        <section className="admin-login-panel">
          <div className="admin-login-panel-header">
            <p className="admin-login-eyebrow">Authorized personnel only</p>
            <h2>{title}</h2>
            <p>
              Access is limited to Evil Genius Games accounts using an <strong>@{allowedDomain}</strong> email address.
            </p>
          </div>

          <div className="admin-login-mode-toggle" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="admin-login-form">
            <label>
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder={`operative@${allowedDomain}`}
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
            </label>

            {error && (
              <div role="alert" className="admin-login-error">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="admin-login-submit">
              {submitting ? 'Checking credentials…' : actionText}
            </button>
          </form>

          <p className="admin-login-helper">
            {isLogin
              ? 'Need clearance? Switch to Create account and register with your Evil Genius Games email.'
              : 'Already cleared for the control room? Switch back to Log in and use your existing account.'}
          </p>
        </section>
      </section>
    </main>
  );
}
