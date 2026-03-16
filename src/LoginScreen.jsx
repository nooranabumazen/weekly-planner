import { useState } from 'react';

export default function LoginScreen({ onLogin, onSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await onSignup(email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential'
        ? 'Invalid email or password'
        : err.code === 'auth/email-already-in-use'
        ? 'Email already in use'
        : err.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters'
        : err.code === 'auth/invalid-email'
        ? 'Invalid email address'
        : err.message;
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#fdfcf8',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: 340, padding: 32, background: '#fff',
        borderRadius: 12, border: '1px solid var(--border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, marginBottom: 4,
          letterSpacing: -0.5, color: '#333',
        }}>
          Weekly Planner
        </h1>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
          {isSignup ? 'Create an account to get started' : 'Sign in to sync your planner'}
        </p>

        {error && (
          <div style={{
            background: '#fff0f0', color: '#c44', border: '1px solid #fdd',
            borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: 14, outline: 'none', marginBottom: 10,
              background: '#fafaf7', boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#bbb')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: 14, outline: 'none', marginBottom: 16,
              background: '#fafaf7', boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#bbb')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '10px 0', background: '#555',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
            }}
          >
            {loading ? '...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 16 }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            onClick={() => { setIsSignup(!isSignup); setError(''); }}
            style={{ color: '#8B6914', cursor: 'pointer', fontWeight: 600 }}
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </span>
        </p>
      </div>
    </div>
  );
}
