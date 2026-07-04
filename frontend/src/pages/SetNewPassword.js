import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FlaskConical, Lock, CheckCircle } from 'lucide-react';

const MIN_LENGTH = 12;

export default function SetNewPassword({ onDone, recoveryConfirmed, recoveryError }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(onDone, 2000);
  }

  const containerStyle = {
    minHeight: '100vh',
    background: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const cardStyle = {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '48px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
  };

  if (done) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <CheckCircle size={48} color="var(--purple-primary)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Password updated</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Taking you to the dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '56px', height: '56px', background: 'var(--purple-primary)',
            borderRadius: '14px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <FlaskConical size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--purple-primary)', letterSpacing: '0.05em' }}>PETLJAK LAB</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Set a new password</p>
        </div>

        {!recoveryConfirmed ? (
          recoveryError ? (
            <div>
              <div style={{
                padding: '12px 16px', background: '#FEF0F0', border: '1px solid #FADBD8',
                borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '13px', marginBottom: '20px',
              }}>
                {recoveryError}
              </div>
              <button
                onClick={onDone}
                style={{
                  width: '100%', padding: '12px', background: 'var(--purple-primary)',
                  color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                  fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '13px', margin: 0 }}>Verifying reset link…</p>
            </div>
          )
        ) : (
          <>
            {error && (
              <div style={{
                padding: '12px 16px', background: '#FEF0F0', border: '1px solid #FADBD8',
                borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '13px', marginBottom: '20px',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {[
                { label: 'New Password', value: password, setter: setPassword },
                { label: 'Confirm Password', value: confirm, setter: setConfirm },
              ].map(({ label, value, setter }) => (
                <div key={label} style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      required
                      style={{
                        width: '100%', padding: '11px 12px 11px 36px',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--purple-primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>
                </div>
              ))}

              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Minimum {MIN_LENGTH} characters.
              </p>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '12px',
                  background: loading ? 'var(--purple-light)' : 'var(--purple-primary)',
                  color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                  fontWeight: 600, fontSize: '14px', cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Updating…' : 'Set New Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
