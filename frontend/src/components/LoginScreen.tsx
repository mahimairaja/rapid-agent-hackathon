import { useState } from 'react';
import { login, setStoredToken, signUp } from '../api/client';

interface LoginScreenProps {
  onLogin: (token: string, isDemoMode: boolean) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Simulate signup delay, then login
      await new Promise(resolve => setTimeout(resolve, 1000));
      const token = await signUp(email, password, name);
      setStoredToken(token.access_token);
      onLogin(token.access_token, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
      setActiveTab('login')
    }
  };

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

          <div className="auth-tab-switcher">
            <button
              id="login-tab-btn"
              type="button"
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
              disabled={activeTab === 'login'}
            >
              Sign in
            </button>
            <button
              id="signup-tab-btn"
              type="button"
              className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => setActiveTab('signup')}
              disabled={activeTab === 'signup'}
            >
              Create account
            </button>
          </div>

          <form className="login-form" onSubmit={activeTab === 'login' ? handleLogin : handleSignup}>
            {error && (
              <div className="form-error" role="alert" style={{ color: 'var(--red-500)', background: 'var(--red-50)', padding: '10px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {activeTab === 'login' ? (
              <>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password"
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      aria-required="true"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>
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
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="signup-name">Full name</label>
                  <input
                    id="signup-name"
                    className="form-input"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                    required
                    aria-required="true"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="signup-email">Email address</label>
                  <input
                    id="signup-email"
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
                  <label className="form-label" htmlFor="signup-password">Create password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="signup-password"
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      aria-required="true"
                      minLength={8}
                      aria-describedby="password-help"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                  <p id="password-help" className="form-help">
                    Minimum 8 characters
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="signup-confirm-password">
                    Confirm password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="signup-confirm-password"
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      aria-required="true"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  id="signup-submit-btn"
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading || !email || !password || !name || !confirmPassword}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Creating account…
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
              </>
            )}
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
