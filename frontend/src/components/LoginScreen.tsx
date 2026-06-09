import { useState } from 'react';
import { login, setStoredToken } from '../api/client';

interface LoginScreenProps {
  onLogin: (token: string, isDemoMode: boolean) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await login(email, password);
      setStoredToken(token.access_token);
      onLogin(token.access_token, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    onLogin('demo', true);
  };

  return (
    <div className="login-screen">
      {/* ── Hero Panel ── */}
      <div className="login-hero">
        <div className="login-hero-grid" aria-hidden />
        <div className="login-hero-content">

          {/* Logo */}
          <div className="login-hero-logo">
            <div className="login-hero-logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="login-hero-logo-text">Rapid Agent</span>
          </div>

          {/* Eyebrow */}
          <div className="login-hero-eyebrow">
            AI Healthcare Recovery Platform
          </div>

          {/* Title */}
          <h1 className="login-hero-title">
            Recovery, guided<br />
            <span className="gradient-text">by intelligence.</span>
          </h1>

          <p className="login-hero-sub">
            Post-discharge shouldn't be a guessing game. Rapid Agent gives every patient a personalized AI recovery guide — 24/7 monitoring, intelligent triage, and real-time care coordination.
          </p>

          {/* Feature list */}
          <div className="login-features">
            {[
              { icon: '🤖', text: 'AI-powered symptom triage & recovery guidance' },
              { icon: '💊', text: 'Smart medication adherence with reminders' },
              { icon: '📅', text: 'Appointment scheduling & preparation briefings' },
              { icon: '👥', text: 'Instant care team escalation when needed' },
              { icon: '📋', text: 'Personalized 12-week recovery milestones' },
            ].map(({ icon, text }) => (
              <div key={text} className="login-feature">
                <div className="login-feature-icon" aria-hidden="true">{icon}</div>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Social proof stats */}
          <div className="login-hero-stats">
            {[
              { value: '94%', label: 'Medication adherence' },
              { value: '3×', label: 'Faster issue detection' },
              { value: '40%', label: 'Fewer readmissions' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="login-hero-stat-value">{value}</div>
                <div className="login-hero-stat-label">{label}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Form Panel ── */}
      <div className="login-panel">
        <div className="login-panel-bg" aria-hidden />
        <div className="login-form-wrapper">

          {/* Mobile-only logo */}
          <div className="login-mobile-logo">
            <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, var(--blue-500), var(--teal-400))', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Rapid Agent</span>
          </div>

          <h2 className="login-form-title">Welcome back</h2>
          <p className="login-form-sub">Sign in to access your recovery dashboard.</p>

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                aria-required="true"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                aria-required="true"
              />
            </div>

            {error && (
              <div className="form-error" role="alert" aria-live="assertive" style={{ marginBottom: 8 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              className="login-submit-btn"
              disabled={loading || !email || !password}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Signing in…
                </>
              ) : (
                'Sign in to dashboard'
              )}
            </button>
          </form>

          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-text">or</span>
            <div className="login-divider-line" />
          </div>

          <button
            id="demo-access-btn"
            type="button"
            className="login-demo-btn"
            onClick={handleDemoAccess}
          >
            🎭 &nbsp;View Live Demo
          </button>

          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
            Demo mode uses <strong>John Matthews</strong>, 64 — Total Hip Replacement patient.<br />
            No backend required.
          </p>

          <div className="login-disclaimer">
            By signing in you agree to our{' '}
            <span style={{ color: 'var(--blue-500)', fontWeight: 600 }}>Terms</span> and{' '}
            <span style={{ color: 'var(--blue-500)', fontWeight: 600 }}>Privacy Policy</span>.<br />
            This platform uses synthetic data for demonstration purposes.
          </div>
        </div>
      </div>
    </div>
  );
}
