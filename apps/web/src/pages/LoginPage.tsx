import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuthStore } from '@/store';
import type { AuthUser } from '@/api/client';

export function LoginPage() {
  const [email, setEmail] = useState('admin@sitebrief.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', { email, password });
      setAuth(res.data.accessToken, res.data.user);
      navigate('/');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, letterSpacing: '-0.01em' }}>Sitebrief</span>
        </div>

        <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-xl)', padding: 32, boxShadow: 'var(--shadow-2)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.015em' }}>Sign in</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 24 }}>Access your site fleet and briefs.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />

            {error && (
              <div style={{ background: 'var(--high-bg)', color: 'var(--high)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)',
                padding: '11px 20px', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-ui)',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                transition: 'opacity var(--dur-base)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        style={{
          background: 'var(--paper-0)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
          padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)',
          outline: 'none', transition: 'border-color var(--dur-base)',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--rule)')}
      />
    </label>
  );
}
