import { useState } from 'react';

export default function Onboarding({ userId, profile, onComplete }) {
  const [form, setForm] = useState({
    phone: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_email: '',
    emergency_contact_relationship: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.address.trim()) e.address = 'Required';
    if (!form.emergency_contact_name.trim()) e.emergency_contact_name = 'Required';
    if (!form.emergency_contact_phone.trim()) e.emergency_contact_phone = 'Required';
    if (!form.emergency_contact_relationship.trim()) e.emergency_contact_relationship = 'Required';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/members/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form }),
      });
      if (!res.ok) throw new Error('Failed to save');
      onComplete();
    } catch (err) {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    }
    setSaving(false);
  }

  const fieldStyle = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none',
    boxSizing: 'border-box', background: 'var(--bg-primary)',
  };
  const labelStyle = {
    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
    display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const errorStyle = { fontSize: '11px', color: 'var(--danger)', marginTop: '3px' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--purple-primary)', letterSpacing: '-0.5px', margin: 0 }}>PETLJAK LAB</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Operations Platform</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '36px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Welcome, {profile?.full_name?.split(' ')[0]}!
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
            Before you get started, please fill in your contact information. This is kept confidential and only visible to lab supervisors.
          </p>

          <form onSubmit={handleSubmit}>

            {/* Phone */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Phone Number</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="e.g. 617-555-0100" style={{ ...fieldStyle, borderColor: errors.phone ? 'var(--danger)' : 'var(--border)' }} />
              {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
            </div>

            {/* Address */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Home Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="e.g. 123 Main St, New York NY 10001" style={{ ...fieldStyle, borderColor: errors.address ? 'var(--danger)' : 'var(--border)' }} />
              {errors.address && <p style={errorStyle}>{errors.address}</p>}
            </div>

            {/* Emergency contact section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency Contact</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Full Name</label>
                <input value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)}
                  placeholder="First and last name" style={{ ...fieldStyle, borderColor: errors.emergency_contact_name ? 'var(--danger)' : 'var(--border)' }} />
                {errors.emergency_contact_name && <p style={errorStyle}>{errors.emergency_contact_name}</p>}
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)}
                  placeholder="617-555-0100" style={{ ...fieldStyle, borderColor: errors.emergency_contact_phone ? 'var(--danger)' : 'var(--border)' }} />
                {errors.emergency_contact_phone && <p style={errorStyle}>{errors.emergency_contact_phone}</p>}
              </div>
              <div>
                <label style={labelStyle}>Relationship</label>
                <input value={form.emergency_contact_relationship} onChange={e => set('emergency_contact_relationship', e.target.value)}
                  placeholder="e.g. Parent, Spouse" style={{ ...fieldStyle, borderColor: errors.emergency_contact_relationship ? 'var(--danger)' : 'var(--border)' }} />
                {errors.emergency_contact_relationship && <p style={errorStyle}>{errors.emergency_contact_relationship}</p>}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Email <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input value={form.emergency_contact_email} onChange={e => set('emergency_contact_email', e.target.value)}
                  placeholder="email@example.com" style={fieldStyle} />
              </div>
            </div>

            {errors.submit && (
              <div style={{ padding: '10px 14px', background: '#FEF0F0', border: '1px solid #FADBD8', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
                {errors.submit}
              </div>
            )}

            <button type="submit" disabled={saving} style={{
              width: '100%', padding: '12px', background: 'var(--purple-primary)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: '8px',
            }}>
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
