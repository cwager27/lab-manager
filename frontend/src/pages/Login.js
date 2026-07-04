import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FlaskConical, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  function logAuthEvent(event_type, fields = {}) {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, ...fields }),
    }).catch(() => {});
  }

  async function handleResetRequest(e) {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');

    try {
      const checkRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const checkData = await checkRes.json();
      if (!checkData.exists) {
        setResetLoading(false);
        setResetError('No account found with that email address.');
        return;
      }
    } catch {
      setResetLoading(false);
      setResetError('Could not verify email. Please try again.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });
    setResetLoading(false);
    if (error) {
      setResetError(error.message);
      return;
    }
    logAuthEvent('password_reset_requested', { target_email: resetEmail });
    setResetSent(true);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      logAuthEvent('failed_login', { target_email: email, details: { reason: error.message } });
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    onLogin(data.user, profile);
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'var(--purple-primary)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <FlaskConical size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--purple-primary)', letterSpacing: '0.05em' }}>PETLJAK LAB</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Operations Platform</p>
        </div>

        {forgotMode ? (
          resetSent ? (
            <div>
              <div style={{ padding: '16px', background: '#EAF7F0', border: '1px solid #A9DFBF', borderRadius: 'var(--radius-md)', color: '#27AE60', fontSize: '13px', marginBottom: '20px' }}>
                Check your inbox — we've sent a password reset link to <strong>{resetEmail}</strong>.
              </div>
              <button onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail(''); }}
                style={{ width: '100%', padding: '12px', background: 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              {resetError && (
                <div style={{ padding: '12px 16px', background: '#FEF0F0', border: '1px solid #FADBD8', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
                  {resetError}
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    placeholder="your@email.com" onKeyDown={e => e.key === 'Enter' && handleResetRequest(e)}
                    style={{ width: '100%', padding: '11px 12px 11px 36px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'var(--purple-primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                </div>
              </div>
              <button onClick={handleResetRequest} disabled={resetLoading || !resetEmail}
                style={{ width: '100%', padding: '12px', background: resetLoading || !resetEmail ? 'var(--purple-light)' : 'var(--purple-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '14px', cursor: resetLoading || !resetEmail ? 'default' : 'pointer', marginBottom: '12px' }}>
                {resetLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button onClick={() => { setForgotMode(false); setResetError(''); }}
                style={{ width: '100%', padding: '10px', background: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: '13px', cursor: 'pointer' }}>
                Back to sign in
              </button>
            </div>
          )
        ) : (
          <>
        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#FEF0F0',
            border: '1px solid #FADBD8',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%', padding: '11px 12px 11px 36px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--purple-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
              style={{
                width: '100%', padding: '11px 36px 11px 36px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--purple-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center'
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '12px',
            background: loading ? 'var(--purple-light)' : 'var(--purple-primary)',
            color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600, fontSize: '14px',
            boxShadow: 'var(--shadow-sm)',
            transition: 'background 0.15s ease'
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <button
          onClick={() => { setForgotMode(true); setError(''); setResetEmail(email); }}
          style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', marginTop: '12px', padding: '4px' }}
        >
          Forgot password?
        </button>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
          Contact your lab administrator to get access.
        </p>
          </>
        )}
      </div>
    </div>
  );
}
