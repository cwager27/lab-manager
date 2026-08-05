import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import {
  Plus, Edit2, Trash2, Phone, Mail,
  Shield, Key, Eye, EyeOff,
  ChevronDown, ChevronUp, Search, CheckCircle, XCircle, Download
} from 'lucide-react';

const ROLE_LABELS = { admin: 'Supervisor', pm: 'Program Manager', member: 'Lab Member', intern: 'Intern', external: 'NYU Contact' };
const ROLE_COLORS = {
  admin:    { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  pm:       { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  member:   { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  intern:   { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  external: { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1' },
};

const PERMISSIONS = [
  { key: 'can_assign_tasks', label: 'Assign Tasks', description: 'Can assign recurrent and ad hoc tasks' },
  { key: 'can_approve_sporadic', label: 'Approve Task Requests', description: 'Can approve or deny ad hoc task requests' },
  { key: 'can_edit_meetings', label: 'Edit Meeting Presenter', description: 'Can change who presents at lab meetings' },
  { key: 'can_view_finance', label: 'View Finance', description: 'Can see grants, orders and reagents' },
  { key: 'can_edit_samples', label: 'Edit Sample Inventory', description: 'Can add, edit and remove samples' },
  { key: 'can_view_contacts', label: 'View Lab Contacts', description: 'Can see the full contact directory' },
  { key: 'can_add_members', label: 'Add Team Members', description: 'Can add new members to the platform' },
];

const DASHBOARD_PERMISSIONS = [
  { key: 'can_see_lab_dashboard', label: 'Lab Dashboard', description: 'Lab-wide productivity, vacations, meetings' },
  { key: 'can_see_leadership_dashboard', label: 'Leadership Dashboard', description: 'Grants and unassigned tasks' },
  { key: 'can_see_personal_dashboard', label: 'Personal Dashboard', description: 'Personal task status and time off' },
];

const EMPTY_CONTACT = {
  first_name: '', last_name: '', role: 'member', title: '', phone: '', email: '',
  personal_email: '', alternative_email: '', address: '', supervisor: '', supervisor_email: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '',
  emergency_contact_relationship: '', status: 'active', sort_order: 99, notes: ''
};

const EMPTY_MEMBER = {
  first_name: '', last_name: '', email: '', password: '', role: 'member',
  can_assign_tasks: false, can_approve_sporadic: false,
  can_edit_meetings: false, can_view_finance: true,
  can_edit_samples: true, can_view_contacts: false, can_add_members: false,
  can_see_lab_dashboard: true, can_see_leadership_dashboard: false, can_see_personal_dashboard: true,
  title: '', personal_email: '', phone: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  emergency_contact_email: '', emergency_contact_relationship: '',
};

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

function formatAddress(raw) {
  if (!raw) return '';
  return raw.replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function getDisplayName(contact) {
  if (contact.last_name && contact.first_name) return `${contact.last_name}, ${contact.first_name}`;
  if (contact.last_name) return contact.last_name;
  if (contact.first_name) return contact.first_name;
  return contact.full_name || '';
}

// "First Last" format — used only for deduplication against profiles.full_name
function getRawName(contact) {
  if (contact.first_name || contact.last_name) {
    return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  }
  return contact.full_name || '';
}

// profiles table stores full_name as "First Last" — convert to "Last, First"
function formatMemberName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const first = parts.slice(0, parts.length - 1).join(' ');
  return `${last}, ${first}`;
}

function getMemberLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts[parts.length - 1] || '';
}

const labelStyle = {
  fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
  display: 'block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const inpStyle = {
  width: '100%', padding: '6px 8px', border: '1px solid var(--border)',
  borderRadius: 4, fontSize: '12px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
};

// Each admin contact row owns its own edit state — no shared state possible
function AdminContactRow({ contact, canManage, canViewPersonalPhone, onUpdate, onDelete, rowIndex }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => ({ ...contact }));
  const [saving, setSaving] = useState(false);
  const roleColors = ROLE_COLORS[contact.role] || ROLE_COLORS.external;

  async function handleSave() {
    setSaving(true);
    await onUpdate(contact.id, form);
    setSaving(false);
    setExpanded(false);
  }

  function openEdit() {
    setForm({ ...contact });
    setExpanded(e => !e);
  }

  const inp = (key, ph = '') => (
    <input style={inpStyle} type="text" value={form[key] || ''} placeholder={ph}
      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
  );
  const phoneInp = (key) => (
    <input style={inpStyle} type="text" value={form[key] || ''} placeholder="xxx-xxx-xxxx"
      onChange={e => setForm(p => ({ ...p, [key]: formatPhone(e.target.value) }))} />
  );

  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)', background: expanded ? 'rgba(123,63,160,0.07)' : rowIndex % 2 === 0 ? 'transparent' : 'var(--purple-faint)' }}>
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: roleColors.bg, border: `2px solid ${roleColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: roleColors.text }}>{(contact.first_name || contact.full_name || '?').charAt(0).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{getDisplayName(contact)}</span>
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
          {contact.email ? <a href={`mailto:${contact.email}`} style={{ color: 'var(--purple-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} />{contact.email}</a> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
        </td>
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px' }}>
            {contact.personal_email ? <a href={`mailto:${contact.personal_email}`} style={{ color: 'var(--purple-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} />{contact.personal_email}</a> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
          </td>
        )}
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {contact.phone ? <a href={`tel:${contact.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{contact.phone}</a> : '—'}
          </td>
        )}
        <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {contact.alternative_email ? <a href={`tel:${contact.alternative_email}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{contact.alternative_email}</a> : '—'}
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>{contact.address || '—'}</td>
        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', width: '100%' }}>{contact.notes || '—'}</td>
        {canManage && (
          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={openEdit}
                style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: `1px solid ${expanded ? 'var(--purple-primary)' : 'var(--border)'}`, background: expanded ? '#F5EEF8' : 'var(--bg-primary)', color: expanded ? 'var(--purple-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                <Edit2 size={13} />
              </button>
              <button onClick={() => onDelete(contact.id)} style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr style={{ background: 'rgba(123,63,160,0.03)' }}>
          <td colSpan={99} style={{ padding: '16px 20px', borderTop: '2px solid var(--purple-primary)', borderBottom: '2px solid var(--purple-primary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>First Name</label>{inp('first_name')}</div>
              <div><label style={labelStyle}>Last Name</label>{inp('last_name')}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>Work Email</label>{inp('email', 'name@work.edu')}</div>
              <div><label style={labelStyle}>Personal Email</label>{inp('personal_email', 'name@gmail.com')}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>Personal Phone</label>{phoneInp('phone')}</div>
              <div><label style={labelStyle}>Work Phone</label>{phoneInp('alternative_email')}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>Title</label>{inp('title', 'e.g. Lab Manager')}</div>
              <div>
                <label style={labelStyle}>Office / Dept</label>
                <input style={inpStyle} type="text" value={form.address || ''} placeholder="Room 123, Science Building..."
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  onBlur={e => setForm(p => ({ ...p, address: formatAddress(e.target.value) }))} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Responsibilities / Notes</label>
              <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} style={{ ...inpStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setExpanded(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AlumniContactRow({ contact, canManage, canViewPersonalPhone, onUpdate, onDelete, rowIndex }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => ({ ...contact }));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onUpdate(contact.id, form);
    setSaving(false);
    setExpanded(false);
  }

  function openEdit() { setForm({ ...contact }); setExpanded(e => !e); }

  const inp = (key, ph = '') => (
    <input style={inpStyle} type="text" value={form[key] || ''} placeholder={ph}
      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
  );
  const phoneInp = (key) => (
    <input style={inpStyle} type="text" value={form[key] || ''} placeholder="xxx-xxx-xxxx"
      onChange={e => setForm(p => ({ ...p, [key]: formatPhone(e.target.value) }))} />
  );

  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)', background: rowIndex % 2 === 0 ? 'transparent' : 'var(--purple-faint)' }}>
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {contact.last_name && contact.first_name ? `${contact.last_name}, ${contact.first_name}` : contact.full_name || '—'}
          </span>
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {contact.email ? <a href={`mailto:${contact.email}`} style={{ color: 'var(--purple-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} />{contact.email}</a> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
            {contact.personal_email && <a href={`mailto:${contact.personal_email}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}><Mail size={10} />{contact.personal_email}</a>}
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {contact.phone ? <a href={`tel:${contact.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{contact.phone}</a> : '—'}
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {contact.dietary_restrictions || '—'}
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.notes || '—'}
        </td>
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: 200 }}>
            {contact.emergency_contact_name ? (
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{contact.emergency_contact_name}{contact.emergency_contact_relationship ? ` (${contact.emergency_contact_relationship})` : ''}</div>
                {contact.emergency_contact_phone && <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><Phone size={11} />{contact.emergency_contact_phone}</div>}
                {contact.emergency_contact_email && <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Mail size={11} />{contact.emergency_contact_email}</div>}
              </div>
            ) : '—'}
          </td>
        )}
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contact.address || ''}>
            {contact.address || '—'}
          </td>
        )}
        {canManage && <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>—</td>}
        {canManage && (
          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={openEdit}
                style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: `1px solid ${expanded ? 'var(--purple-primary)' : 'var(--border)'}`, background: expanded ? '#F5EEF8' : 'var(--bg-primary)', color: expanded ? 'var(--purple-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                <Edit2 size={13} />
              </button>
              <button onClick={() => onDelete(contact.id)} style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>
            </div>
          </td>
        )}
      </tr>
      {expanded && canManage && (
        <tr style={{ background: 'rgba(123,63,160,0.03)' }}>
          <td colSpan={99} style={{ padding: '16px 20px', borderTop: '2px solid var(--purple-primary)', borderBottom: '2px solid var(--purple-primary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>First Name</label>{inp('first_name')}</div>
              <div><label style={labelStyle}>Last Name</label>{inp('last_name')}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>Work Email</label>{inp('email', 'name@work.edu')}</div>
              <div><label style={labelStyle}>Personal Email</label>{inp('personal_email', 'name@gmail.com')}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>Phone</label>{phoneInp('phone')}</div>
              <div><label style={labelStyle}>Dietary Restrictions</label>{inp('dietary_restrictions', 'e.g. Vegetarian, Nut allergy…')}</div>
              <div>
                <label style={labelStyle}>Address</label>
                <input style={inpStyle} type="text" value={form.address || ''} placeholder="123 Main St, Apt 4B..."
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  onBlur={e => setForm(p => ({ ...p, address: formatAddress(e.target.value) }))} />
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
              <span style={{ ...labelStyle, display: 'inline' }}>Emergency Contact</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>Name</label>{inp('emergency_contact_name', 'Jane Doe')}</div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inpStyle} type="text" value={form.emergency_contact_phone || ''} placeholder="xxx-xxx-xxxx"
                  onChange={e => setForm(p => ({ ...p, emergency_contact_phone: formatPhone(e.target.value) }))} />
              </div>
              <div><label style={labelStyle}>Email</label>{inp('emergency_contact_email', 'name@example.com')}</div>
              <div><label style={labelStyle}>Relationship</label>{inp('emergency_contact_relationship', 'e.g. Parent')}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} style={{ ...inpStyle, resize: 'vertical' }} placeholder="e.g. Graduated 2023, now at industry…" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setExpanded(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LabMemberRow({ member, canManage, canViewPersonalPhone, userId, isAdmin, onUpdatePermissions, onUpdateRole, onUpdateLabStatus, onDelete, onChangePassword, onUpdateOffboarding, isAlumni, rowIndex, initialExtraData }) {
  const [extraData, setExtraData] = useState(initialExtraData || null);
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [form, setForm] = useState({
    phone: '', personal_email: '', address: '', dietary_restrictions: '', notes: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    emergency_contact_email: '', emergency_contact_relationship: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const roleColors = ROLE_COLORS[member.role] || ROLE_COLORS.member;

  async function loadExtra() {
    const nameParts = (member.full_name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Try matching by full_name generated column first, then fall back to first+last split
    let { data } = await supabase
      .from('lab_contacts')
      .select('*')
      .eq('full_name', member.full_name)
      .neq('role', 'external')
      .limit(1);

    if (!data?.length) {
      ({ data } = await supabase
        .from('lab_contacts')
        .select('*')
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .neq('role', 'external')
        .limit(1));
    }

    setExtraData(data?.[0] || null);
  }

  function openContactEdit() {
    setForm({
      phone: extraData?.phone || '',
      personal_email: extraData?.personal_email || '',
      address: extraData?.address || '',
      dietary_restrictions: extraData?.dietary_restrictions || '',
      notes: extraData?.notes || '',
      emergency_contact_name: extraData?.emergency_contact_name || '',
      emergency_contact_phone: extraData?.emergency_contact_phone || '',
      emergency_contact_email: extraData?.emergency_contact_email || '',
      emergency_contact_relationship: extraData?.emergency_contact_relationship || '',
    });
    setShowContactEdit(e => !e);
  }

  async function handleSaveContact() {
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        phone: form.phone || '',
        personal_email: form.personal_email || '',
        address: form.address || '',
        dietary_restrictions: form.dietary_restrictions || '',
        notes: form.notes || '',
        emergency_contact_name: form.emergency_contact_name || '',
        emergency_contact_phone: form.emergency_contact_phone || '',
        emergency_contact_email: form.emergency_contact_email || '',
        emergency_contact_relationship: form.emergency_contact_relationship || '',
      };
      if (extraData?.id) {
        const { error } = await supabase.from('lab_contacts').update(payload).eq('id', extraData.id);
        if (error) throw error;
        setExtraData(prev => ({ ...prev, ...payload }));
      } else {
        const nameParts = (member.full_name || '').split(' ');
        const { error } = await supabase.from('lab_contacts').insert([{
          ...payload,
          email: member.email,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          role: 'member',
          sort_order: 99,
        }]);
        if (error) throw error;
        await loadExtra();
      }
      setShowContactEdit(false);
    } catch (err) {
      setSaveError(err?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inp = (key, ph = '') => (
    <input style={inpStyle} type="text" value={form[key] || ''} placeholder={ph}
      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
  );

  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)', background: rowIndex % 2 === 0 ? 'transparent' : 'var(--purple-faint)' }}>
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: roleColors.bg, border: `2px solid ${roleColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: roleColors.text }}>{member.full_name?.charAt(0).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatMemberName(member.full_name)}</span>
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {(extraData?.email || member.email) ? <a href={`mailto:${extraData?.email || member.email}`} style={{ color: 'var(--purple-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} />{extraData?.email || member.email}</a> : '—'}
            {extraData?.personal_email && <a href={`mailto:${extraData.personal_email}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}><Mail size={10} />{extraData.personal_email}</a>}
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {extraData?.phone ? <a href={`tel:${extraData.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{extraData.phone}</a> : '—'}
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {extraData?.dietary_restrictions || '—'}
        </td>
        {isAlumni && <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={extraData?.notes || ''}>{extraData?.notes || '—'}</td>}
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
            {extraData?.emergency_contact_name ? (
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{extraData.emergency_contact_name}{extraData.emergency_contact_relationship ? ` (${extraData.emergency_contact_relationship})` : ''}</div>
                {extraData.emergency_contact_phone && <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><Phone size={11} />{extraData.emergency_contact_phone}</div>}
                {extraData.emergency_contact_email && <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Mail size={11} />{extraData.emergency_contact_email}</div>}
              </div>
            ) : '—'}
          </td>
        )}
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={extraData?.address || ''}>
            {extraData?.address || '—'}
          </td>
        )}
        {isAlumni && canManage && (
          <td style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { key: 'offboarding_slack', label: 'Slack' },
                { key: 'offboarding_platform', label: 'Platform' },
                { key: 'offboarding_gdrive', label: 'Gdrive' },
              ].map(({ key, label }) => {
                const done = !!member[key];
                return (
                  <button key={key} onClick={() => onUpdateOffboarding && onUpdateOffboarding(member.id, key, !done)}
                    style={{
                      padding: '3px 8px', borderRadius: '12px', cursor: 'pointer',
                      border: `1px solid ${done ? '#A9DFBF' : '#FADBD8'}`,
                      background: done ? '#EAF7F0' : '#FEF0F0',
                      color: done ? '#27AE60' : '#E74C3C',
                      fontSize: '11px', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '3px'
                    }}>
                    {done ? <CheckCircle size={10} /> : <XCircle size={10} />}{label}
                  </button>
                );
              })}
            </div>
          </td>
        )}
        {canManage && (
          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={openContactEdit}
                style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: `1px solid ${showContactEdit ? 'var(--purple-primary)' : 'var(--border)'}`, background: showContactEdit ? '#F5EEF8' : 'var(--bg-primary)', color: showContactEdit ? 'var(--purple-primary)' : 'var(--text-muted)', cursor: 'pointer' }} title="Edit contact info">
                <Edit2 size={13} />
              </button>
              {member.id !== userId && (
                <button onClick={() => setShowPerms(e => !e)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                  <Shield size={12} /> {showPerms ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
              {member.id !== userId && onUpdateLabStatus && (
                <button
                  onClick={() => onUpdateLabStatus(member.id, member.lab_status === 'alumni' ? 'active' : 'alumni')}
                  title={member.lab_status === 'alumni' ? 'Move back to active members' : 'Move to alumni'}
                  style={{ padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
                  {member.lab_status === 'alumni' ? 'Active' : 'Alumni'}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => onChangePassword(member)}
                  style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer' }} title="Set password">
                  <Key size={13} />
                </button>
              )}
              {member.id !== userId && (
                <button onClick={() => onDelete(member)} style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }} title="Remove member"><Trash2 size={13} /></button>
              )}
            </div>
          </td>
        )}
      </tr>
      {showContactEdit && (
        <tr style={{ background: 'rgba(123,63,160,0.03)' }}>
          <td colSpan={99} style={{ padding: '16px 20px', borderTop: '2px solid var(--purple-primary)', borderBottom: '2px solid var(--purple-primary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: canViewPersonalPhone ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inpStyle} type="text" value={form.phone || ''} placeholder="xxx-xxx-xxxx"
                  onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))} />
              </div>
              <div>
                <label style={labelStyle}>Personal Email</label>
                <input style={inpStyle} type="text" value={form.personal_email || ''} placeholder="name@gmail.com"
                  onChange={e => setForm(p => ({ ...p, personal_email: e.target.value }))} />
              </div>
              {canViewPersonalPhone && (
                <div>
                  <label style={labelStyle}>Address</label>
                  <input style={inpStyle} type="text" value={form.address || ''} placeholder="123 Main St, Apt 4B..."
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    onBlur={e => setForm(p => ({ ...p, address: formatAddress(e.target.value) }))} />
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Dietary Restrictions</label>
                <input style={inpStyle} type="text" value={form.dietary_restrictions || ''} placeholder="e.g. Vegetarian, Nut allergy, Gluten-free…"
                  onChange={e => setForm(p => ({ ...p, dietary_restrictions: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input style={inpStyle} type="text" value={form.notes || ''} placeholder="e.g. Graduated 2023, current position…"
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span style={{ ...labelStyle, display: 'inline' }}>Emergency Contact</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div><label style={labelStyle}>Name</label>{inp('emergency_contact_name', 'Jane Doe')}</div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inpStyle} type="text" value={form.emergency_contact_phone || ''} placeholder="xxx-xxx-xxxx"
                  onChange={e => setForm(p => ({ ...p, emergency_contact_phone: formatPhone(e.target.value) }))} />
              </div>
              <div><label style={labelStyle}>Email</label>{inp('emergency_contact_email', 'name@example.com')}</div>
              <div><label style={labelStyle}>Relationship</label>{inp('emergency_contact_relationship', 'e.g. Parent')}</div>
            </div>
            {saveError && <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: 8, textAlign: 'right' }}>{saveError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowContactEdit(false); setSaveError(''); }} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveContact} disabled={saving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </td>
        </tr>
      )}
      {showPerms && canManage && (
        <tr style={{ background: 'var(--bg-secondary)' }}>
          <td colSpan={canViewPersonalPhone ? 6 : 4} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            {/* Role selector */}
            {isAdmin && onUpdateRole && (
              <div style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['admin', 'pm', 'member', 'intern'].map(role => {
                    const rc = ROLE_COLORS[role] || ROLE_COLORS.member;
                    const isActive = member.role === role;
                    return (
                      <button key={role} onClick={() => onUpdateRole(member.id, role)}
                        style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: isActive ? 700 : 500, cursor: isActive ? 'default' : 'pointer', border: `2px solid ${isActive ? rc.border : 'var(--border)'}`, background: isActive ? rc.bg : 'var(--bg-primary)', color: isActive ? rc.text : 'var(--text-secondary)' }}>
                        {ROLE_LABELS[role]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Permission toggles */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permissions</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {PERMISSIONS.map(perm => (
                  <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{perm.label}</p>
                    <button onClick={() => onUpdatePermissions(member.id, perm.key, !member[perm.key])}
                      style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: member[perm.key] ? 'var(--purple-primary)' : 'var(--border)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: member[perm.key] ? '19px' : '3px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Presenter rotation */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lab Meeting Rotor</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: `1px solid ${member.is_presenter ? 'rgba(123,63,160,0.3)' : 'var(--border)'}`, maxWidth: 280 }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: member.is_presenter ? 'var(--purple-primary)' : 'var(--text-secondary)' }}>Presenter</p>
                  <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>Included in the lab meeting rotation</p>
                </div>
                <button onClick={() => onUpdatePermissions(member.id, 'is_presenter', !member.is_presenter)}
                  style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: member.is_presenter ? 'var(--purple-primary)' : 'var(--border)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: member.is_presenter ? '19px' : '3px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            </div>

            {/* Dashboard access */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard Access</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {DASHBOARD_PERMISSIONS.map(perm => {
                  const isOn = member[perm.key] !== false;
                  return (
                    <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: `1px solid ${isOn ? 'rgba(123,63,160,0.3)' : 'var(--border)'}`, minWidth: 180 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: isOn ? 'var(--purple-primary)' : 'var(--text-secondary)' }}>{perm.label}</p>
                        <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>{perm.description}</p>
                      </div>
                      <button onClick={() => onUpdatePermissions(member.id, perm.key, !isOn)}
                        style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: isOn ? 'var(--purple-primary)' : 'var(--border)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: isOn ? '19px' : '3px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LabContacts({ userRole, userId, profile, permissions }) {
  const [contacts, setContacts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminSearch, setAdminSearch] = useState('');
  const [labSearch, setLabSearch] = useState('');
  const [alumniSearch, setAlumniSearch] = useState('');
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('contacts_tab') || 'admin');
  const [showContactForm, setShowContactForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER);
  const [saving, setSaving] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [confirmDeleteMember, setConfirmDeleteMember] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showFormPw, setShowFormPw] = useState(false);

  const canManage = userRole === 'admin' || (permissions?.can_add_members);
  const canViewPersonalPhone = userRole === 'admin' || userRole === 'pm' || profile?.full_name?.toLowerCase().startsWith('mia');

  function logAuthEvent(event_type, fields = {}) {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, ...fields }),
    }).catch(() => {});
  }

  useEffect(() => { localStorage.setItem('contacts_tab', activeTab); }, [activeTab]);
  useEffect(() => { fetchData(); }, []);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    const [{ data: contactData }, { data: memberData }] = await Promise.all([
      supabase.from('lab_contacts').select('*').order('last_name').order('first_name'),
      supabase.from('profiles').select('*').order('full_name')
    ]);
    setContacts(contactData || []);
    setMembers(memberData || []);
    if (!silent) setLoading(false);
  }

  async function handleSaveContact(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: `${contactForm.first_name || ''} ${contactForm.last_name || ''}`.trim(),
      first_name: contactForm.first_name || '',
      last_name: contactForm.last_name || '',
      role: 'external',
      title: contactForm.title || '',
      phone: contactForm.phone || '',
      email: contactForm.email || '',
      personal_email: contactForm.personal_email || '',
      alternative_email: contactForm.alternative_email || '',
      address: contactForm.address || '',
      supervisor: contactForm.supervisor || '',
      supervisor_email: contactForm.supervisor_email || '',
      emergency_contact_name: contactForm.emergency_contact_name || '',
      emergency_contact_phone: contactForm.emergency_contact_phone || '',
      emergency_contact_email: contactForm.emergency_contact_email || '',
      emergency_contact_relationship: contactForm.emergency_contact_relationship || '',
      status: 'active',
      sort_order: 99,
      notes: contactForm.notes || '',
    };
    await supabase.from('lab_contacts').insert([payload]);
    setSaving(false);
    setShowContactForm(false);
    setContactForm(EMPTY_CONTACT);
    await fetchData();
  }

  async function handleDeleteContact(id) {
    if (window.confirm('Remove this contact?')) {
      await supabase.from('lab_contacts').delete().eq('id', id);
      fetchData();
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    setSaving(true);
    setMemberError('');
    try {
      const fullName = `${memberForm.first_name} ${memberForm.last_name}`.trim();
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/members/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberForm.email,
          password: memberForm.password,
          fullName,
          role: memberForm.role,
          createdById: userId,
          createdByName: profile?.full_name,
          permissions: {
            can_assign_tasks: memberForm.can_assign_tasks,
            can_approve_sporadic: memberForm.can_approve_sporadic,
            can_edit_meetings: memberForm.can_edit_meetings,
            can_view_finance: memberForm.can_view_finance,
            can_edit_samples: memberForm.can_edit_samples,
            can_view_contacts: memberForm.can_view_contacts,
            can_add_members: memberForm.can_add_members,
          },
          contactInfo: {
            title: memberForm.title,
            personal_email: memberForm.personal_email,
            phone: memberForm.phone,
            address: memberForm.address,
            emergency_contact_name: memberForm.emergency_contact_name,
            emergency_contact_phone: memberForm.emergency_contact_phone,
            emergency_contact_email: memberForm.emergency_contact_email,
            emergency_contact_relationship: memberForm.emergency_contact_relationship,
          },
        })
      });
      const result = await res.json();
      if (!res.ok) {
        setMemberError(result.error || 'Failed to create member');
        setSaving(false);
        return;
      }
      await fetchData();
      setShowMemberForm(false);
      setMemberForm(EMPTY_MEMBER);
      setShowFormPw(false);
    } catch (err) {
      setMemberError('Network error — please try again');
      console.error('Create member error:', err);
    }
    setSaving(false);
  }

  async function handleUpdatePermissions(memberId, key, value) {
    await supabase.from('profiles').update({ [key]: value }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, [key]: value } : m));
  }

  async function handleUpdateRole(memberId, role) {
    const defaults = {
      admin: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: true, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true, can_see_lab_dashboard: true, can_see_leadership_dashboard: true, can_see_personal_dashboard: true },
      pm: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true, can_see_lab_dashboard: true, can_see_leadership_dashboard: true, can_see_personal_dashboard: true },
      member: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: false, can_add_members: false, can_see_lab_dashboard: true, can_see_leadership_dashboard: false, can_see_personal_dashboard: true },
      intern: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: false, can_edit_samples: true, can_view_contacts: false, can_add_members: false, can_see_lab_dashboard: false, can_see_leadership_dashboard: false, can_see_personal_dashboard: true },
    };
    const oldRole = members.find(m => m.id === memberId)?.role;
    await supabase.from('profiles').update({ role, ...defaults[role] }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role, ...defaults[role] } : m));
    logAuthEvent('role_changed', {
      actor_id: userId, actor_name: profile?.full_name,
      target_id: memberId,
      details: { from: oldRole, to: role },
    });
  }

  async function handleUpdateLabStatus(memberId, status) {
    const { error } = await supabase.from('profiles').update({ lab_status: status }).eq('id', memberId);
    if (error) {
      alert(`Could not update lab status: ${error.message}\n\nIf this keeps happening, run the SQL migration in Supabase:\nalter table profiles add column if not exists lab_status text default 'active';`);
      return;
    }

    // Update local state immediately and sync with DB
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, lab_status: status } : m));
    fetchData(true);

    if (status === 'alumni') {
      const member = members.find(m => m.id === memberId);
      const name = member?.full_name || 'Member';
      // Assign offboarding tasks to both admin (Mia) and PM
      const { data: adminData } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
      const { data: pmData } = await supabase.from('profiles').select('id').eq('role', 'pm').limit(1);
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const dueDate = due.toISOString().split('T')[0];
      const assignees = [...new Set([adminData?.[0]?.id, pmData?.[0]?.id].filter(Boolean))];
      const taskTitles = [
        `Remove ${name} — Slack access`,
        `Remove ${name} — Lab Platform access`,
        `Remove ${name} — Google Drive access`,
      ];
      const rows = assignees.flatMap(assignTo =>
        taskTitles.map(title => ({ title, category: 'MISC', response_type: 'checkbox', status: 'approved', assigned_to: assignTo, assigned_by: userId, due_date: dueDate }))
      );
      if (rows.length) await supabase.from('sporadic_tasks').insert(rows);
      // Reassign any future lab meetings the person was scheduled to present
      fetch(`${process.env.REACT_APP_BACKEND_URL}/api/members/alumni-reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, memberName: name }),
      }).catch(() => {});
    }
  }

  async function handleUpdateOffboarding(memberId, key, value) {
    await supabase.from('profiles').update({ [key]: value }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, [key]: value } : m));
  }

  function setDefaultPermissions(role) {
    const defaults = {
      admin: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: true, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true, can_see_lab_dashboard: true, can_see_leadership_dashboard: true, can_see_personal_dashboard: true },
      pm: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true, can_see_lab_dashboard: true, can_see_leadership_dashboard: true, can_see_personal_dashboard: true },
      member: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: false, can_add_members: false, can_see_lab_dashboard: true, can_see_leadership_dashboard: false, can_see_personal_dashboard: true },
      intern: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: false, can_edit_samples: true, can_view_contacts: false, can_add_members: false, can_see_lab_dashboard: false, can_see_leadership_dashboard: false, can_see_personal_dashboard: true },
    };
    setMemberForm(p => ({ ...p, role, ...defaults[role] }));
  }

  async function updateAdminContact(contactId, form) {
    const payload = {
      first_name: form.first_name || '',
      last_name: form.last_name || '',
      role: form.role || 'external',
      title: form.title || '',
      phone: form.phone || '',
      email: form.email || '',
      personal_email: form.personal_email || '',
      alternative_email: form.alternative_email || '',
      address: form.address || '',
      supervisor: form.supervisor || '',
      supervisor_email: form.supervisor_email || '',
      emergency_contact_name: form.emergency_contact_name || '',
      emergency_contact_phone: form.emergency_contact_phone || '',
      emergency_contact_email: form.emergency_contact_email || '',
      emergency_contact_relationship: form.emergency_contact_relationship || '',
      status: form.status || 'active',
      sort_order: form.sort_order ?? 99,
      notes: form.notes || '',
    };
    const { error } = await supabase.from('lab_contacts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', contactId);
    if (error) {
      alert(`Failed to save contact: ${error.message}\n\nIf this keeps happening, run in Supabase SQL editor:\nALTER TABLE lab_contacts ADD COLUMN IF NOT EXISTS alternative_email text;`);
      return;
    }
    await fetchData(true);
  }

  async function handleDeleteMember(member) {
    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/members/${member.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      logAuthEvent('member_removed', { actor_id: userId, actor_name: profile?.full_name, target_id: member.id, target_email: member.email, details: { full_name: member.full_name } });
      fetchData();
    } catch (err) {
      console.error('Delete member error:', err);
      alert('Failed to remove member: ' + err.message);
    }
    setSaving(false);
    setConfirmDeleteMember(null);
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwSaving(true);
    setPwError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/change-member-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: passwordTarget.id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setPwSuccess(true);
      setTimeout(() => { setPasswordTarget(null); setNewPassword(''); setShowPw(false); setPwSuccess(false); }, 1800);
    } catch (err) {
      setPwError(err.message);
    }
    setPwSaving(false);
  }

  const memberNames = new Set(members.map(m => m.full_name?.toLowerCase().trim()).filter(Boolean));
  const memberEmails = new Set(members.map(m => m.email?.toLowerCase().trim()).filter(Boolean));
  const sortedMembers = [...members].sort((a, b) =>
    getMemberLastName(a.full_name).localeCompare(getMemberLastName(b.full_name)) ||
    (a.full_name || '').localeCompare(b.full_name || '')
  );

  const countFields = c => [c.first_name, c.last_name, c.email, c.personal_email, c.phone, c.alternative_email, c.title, c.address, c.notes, c.supervisor, c.emergency_contact_name].filter(v => v && String(v).trim()).length;

  const filteredAdminContacts = Object.values(
    contacts
      .filter(c => (c.role === 'external' || c.role === 'member') && c.status !== 'alumni')
      .reduce((acc, c) => {
        const key = `${(c.last_name || '').toLowerCase().trim()}__${(c.first_name || '').toLowerCase().trim()}`;
        if (!acc[key] || countFields(c) > countFields(acc[key])) acc[key] = c;
        return acc;
      }, {})
  )
    .filter(c => {
      if (!adminSearch) return true;
      const q = adminSearch.toLowerCase();
      return [getDisplayName(c), c.title, c.email, c.phone, c.notes, c.address]
        .some(v => v?.toLowerCase().includes(q));
    })
    .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || ''));

  const filteredLabMembers = sortedMembers.filter(m => {
    if (m.lab_status === 'alumni') return false;
    if (!labSearch) return true;
    const q = labSearch.toLowerCase();
    return [m.full_name, m.email, ROLE_LABELS[m.role]].some(v => v?.toLowerCase().includes(q));
  });

  const filteredAlumni = sortedMembers.filter(m => {
    if (m.lab_status !== 'alumni') return false;
    if (!alumniSearch) return true;
    const q = alumniSearch.toLowerCase();
    return [m.full_name, m.email, ROLE_LABELS[m.role]].some(v => v?.toLowerCase().includes(q));
  });

  const filteredAlumniContacts = contacts.filter(c => {
    if (c.status !== 'alumni') return false;
    if (!alumniSearch) return true;
    const q = alumniSearch.toLowerCase();
    return [c.full_name, c.email, c.phone, c.notes].some(v => v?.toLowerCase().includes(q));
  }).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '') || (a.first_name || '').localeCompare(b.first_name || ''));

  // Pre-compute extraData for each member so LabMemberRow doesn't need per-row async fetches
  const memberExtraMap = {};
  contacts.filter(c => c.role !== 'external').forEach(c => {
    if (c.full_name) memberExtraMap[c.full_name.toLowerCase().trim()] = c;
  });

  function handleExport() {
    const wb = XLSX.utils.book_new();

    // Admin sheet
    const adminRows = filteredAdminContacts.map(c => ({
      'Name': getDisplayName(c),
      'Title': c.title || '',
      'Work Email': c.email || '',
      'Work Phone': c.alternative_email || '',
      'Personal Phone': c.phone || '',
      'Office / Dept': c.address || '',
      'Responsibilities': c.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adminRows), 'Admin Contacts');

    // Lab sheet — combine profile members + pending contacts
    const labRows = [
      ...sortedMembers.filter(m => m.lab_status !== 'alumni').map(m => {
        const ex = memberExtraMap[(m.full_name || '').toLowerCase().trim()] || {};
        return {
          'Name': formatMemberName(m.full_name),
          'Role': ROLE_LABELS[m.role] || m.role,
          'Work Email': m.email || '',
          'Personal Email': ex.personal_email || '',
          'Phone': ex.phone || '',
          'Dietary': ex.dietary_restrictions || '',
          'Address': ex.address || '',
          'Emergency Contact': ex.emergency_contact_name ? `${ex.emergency_contact_name}${ex.emergency_contact_relationship ? ` (${ex.emergency_contact_relationship})` : ''}` : '',
          'Emergency Phone': ex.emergency_contact_phone || '',
          'Emergency Email': ex.emergency_contact_email || '',
          'Notes': ex.notes || '',
        };
      }),
      ...contacts.filter(c => {
        if (c.role === 'external') return false;
        if (memberNames.has(getRawName(c).toLowerCase().trim())) return false;
        if (c.email && memberEmails.has(c.email.toLowerCase().trim())) return false;
        return true;
      }).map(c => ({
        'Name': getDisplayName(c),
        'Role': '',
        'Work Email': c.email || '',
        'Personal Email': c.personal_email || '',
        'Phone': c.phone || '',
        'Dietary': '',
        'Address': c.address || '',
        'Emergency Contact': '',
        'Emergency Phone': '',
        'Emergency Email': '',
        'Notes': c.notes || '',
      })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(labRows), 'Lab Contacts');

    // Alumni sheet
    const alumniRows = [
      ...sortedMembers.filter(m => m.lab_status === 'alumni').map(m => {
        const ex = memberExtraMap[(m.full_name || '').toLowerCase().trim()] || {};
        return {
          'Name': formatMemberName(m.full_name),
          'Work Email': m.email || '',
          'Personal Email': ex.personal_email || '',
          'Phone': ex.phone || '',
          'Dietary': ex.dietary_restrictions || '',
          'Notes': ex.notes || '',
          'Address': ex.address || '',
          'Emergency Contact': ex.emergency_contact_name ? `${ex.emergency_contact_name}${ex.emergency_contact_relationship ? ` (${ex.emergency_contact_relationship})` : ''}` : '',
          'Emergency Phone': ex.emergency_contact_phone || '',
          'Emergency Email': ex.emergency_contact_email || '',
        };
      }),
      ...contacts.filter(c => c.status === 'alumni').map(c => ({
        'Name': getDisplayName(c),
        'Work Email': c.email || '',
        'Personal Email': c.personal_email || '',
        'Phone': c.phone || '',
        'Dietary': '',
        'Notes': c.notes || '',
        'Address': c.address || '',
        'Emergency Contact': '',
        'Emergency Phone': '',
        'Emergency Email': '',
      })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alumniRows), 'Alumni');

    XLSX.writeFile(wb, `lab-contacts-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const pendingLabContacts = contacts.filter(c => {
    if (c.role === 'external') return false;
    if (c.status === 'alumni') return false;
    if (memberNames.has(getRawName(c).toLowerCase().trim())) return false;
    if (c.email && memberEmails.has(c.email.toLowerCase().trim())) return false;
    if (!labSearch) return true;
    const q = labSearch.toLowerCase();
    return [getDisplayName(c), c.email, c.phone, c.address, c.emergency_contact_name].some(v => v?.toLowerCase().includes(q));
  });

  return (
    <div>
      {/* Tab switcher + actions inline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width: 'fit-content' }}>
          {[{ id: 'admin', label: 'Admin Contacts' }, { id: 'lab', label: 'Lab Contacts' }, { id: 'alumni', label: 'Alumni' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '10px 20px', background: activeTab === tab.id ? 'var(--purple-primary)' : 'transparent', color: activeTab === tab.id ? 'white' : 'var(--text-secondary)', border: 'none', fontWeight: activeTab === tab.id ? 600 : 400, fontSize: '13px', cursor: 'pointer' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={handleExport} title="Export all contacts to Excel" style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontWeight: 500, fontSize: '13px', cursor: 'pointer'
          }}><Download size={15} /> Export</button>
          {canManage && activeTab === 'admin' && (
            <button onClick={() => { setContactForm(EMPTY_CONTACT); setShowContactForm(true); }} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              background: 'var(--purple-primary)', color: 'white', border: 'none',
              borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
            }}><Plus size={16} /> Add Contact</button>
          )}
          {canManage && (activeTab === 'lab' || activeTab === 'alumni') && (
            <button onClick={() => { setMemberForm(EMPTY_MEMBER); setShowMemberForm(true); }} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              background: 'var(--purple-primary)', color: 'white', border: 'none',
              borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
            }}><Plus size={16} /> Add Member</button>
          )}
        </div>
      </div>

      {/* Admin Contacts tab */}
      {activeTab === 'admin' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '16px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="Search admin contacts..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {[
                      'Name', 'Work Email', ...(canViewPersonalPhone ? ['Personal Email', 'Personal Phone'] : []),
                      'Work Phone', 'Office / Dept', 'Responsibilities',
                      ...(canManage ? [''] : [])
                    ].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAdminContacts.length === 0 ? (
                    <tr><td colSpan={99} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No admin contacts yet.</td></tr>
                  ) : filteredAdminContacts.map((contact, i) => (
                    <AdminContactRow
                      key={contact.id}
                      contact={contact}
                      canManage={canManage}
                      canViewPersonalPhone={canViewPersonalPhone}
                      onUpdate={updateAdminContact}
                      onDelete={handleDeleteContact}
                      rowIndex={i}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Lab Contacts tab */}
      {activeTab === 'lab' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '16px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={labSearch} onChange={e => setLabSearch(e.target.value)} placeholder="Search lab contacts..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {[
                      'Name', 'Email', 'Phone', 'Dietary',
                      ...(canViewPersonalPhone ? ['Emergency Contact'] : []),
                      ...(canViewPersonalPhone ? ['Address'] : []),
                      ...(canManage ? [''] : [])
                    ].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLabMembers.length === 0 && (!canManage || pendingLabContacts.length === 0) ? (
                    <tr><td colSpan={99} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No lab contacts found.</td></tr>
                  ) : filteredLabMembers.map((member, i) => (
                    <LabMemberRow
                      key={member.id}
                      member={member}
                      canManage={canManage}
                      canViewPersonalPhone={canViewPersonalPhone}
                      userId={userId}
                      isAdmin={userRole === 'admin'}
                      onUpdatePermissions={handleUpdatePermissions}
                      onUpdateRole={handleUpdateRole}
                      onUpdateLabStatus={canManage ? handleUpdateLabStatus : null}
                      onDelete={setConfirmDeleteMember}
                      onChangePassword={setPasswordTarget}
                      rowIndex={i}
                      initialExtraData={memberExtraMap[(member.full_name || '').toLowerCase().trim()] || null}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Lab Alumni tab */}
      {activeTab === 'alumni' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '16px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={alumniSearch} onChange={e => setAlumniSearch(e.target.value)} placeholder="Search alumni..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {[
                      'Name', 'Email', 'Phone', 'Dietary', 'Notes',
                      ...(canViewPersonalPhone ? ['Emergency Contact'] : []),
                      ...(canViewPersonalPhone ? ['Address'] : []),
                      ...(canManage ? ['Offboarding'] : []),
                      ...(canManage ? [''] : [])
                    ].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAlumni.length === 0 && filteredAlumniContacts.length === 0 ? (
                    <tr><td colSpan={99} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No alumni yet. Move a lab member to alumni using the Alumni button in their row.</td></tr>
                  ) : (
                    <>
                      {filteredAlumni.map((member, i) => (
                        <LabMemberRow
                          key={member.id}
                          member={member}
                          canManage={canManage}
                          canViewPersonalPhone={canViewPersonalPhone}
                          userId={userId}
                          isAdmin={userRole === 'admin'}
                          onUpdatePermissions={handleUpdatePermissions}
                          onUpdateRole={handleUpdateRole}
                          onUpdateLabStatus={canManage ? handleUpdateLabStatus : null}
                          onDelete={setConfirmDeleteMember}
                          onChangePassword={setPasswordTarget}
                          onUpdateOffboarding={canManage ? handleUpdateOffboarding : null}
                          isAlumni={true}
                          rowIndex={i}
                          initialExtraData={memberExtraMap[(member.full_name || '').toLowerCase().trim()] || null}
                        />
                      ))}
                      {filteredAlumniContacts.map((c, i) => (
                        <AlumniContactRow
                          key={c.id}
                          contact={c}
                          canManage={canManage}
                          canViewPersonalPhone={canViewPersonalPhone}
                          onUpdate={updateAdminContact}
                          onDelete={handleDeleteContact}
                          rowIndex={filteredAlumni.length + i}
                        />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Confirm Delete Member Modal */}
      {confirmDeleteMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '420px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--danger)' }}>Remove Member</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Are you sure you want to remove <strong>{confirmDeleteMember.full_name}</strong> from the platform?
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Their assigned tasks will be unassigned and their scheduled meeting slots will be cleared.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteMember(null)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDeleteMember(confirmDeleteMember)} disabled={saving} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--danger)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showContactForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Add Admin Contact</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>For lab members with login accounts, use Add Member on the Lab Contacts tab.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              {[{ key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' }].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                  <input type="text" value={contactForm[field.key] || ''} onChange={e => setContactForm(p => ({ ...p, [field.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            {[
              { key: 'email', label: 'Work Email', placeholder: 'name@work.edu' },
              { key: 'personal_email', label: 'Personal Email', placeholder: 'name@gmail.com' },
              { key: 'phone', label: 'Personal Phone', placeholder: 'xxx-xxx-xxxx', format: formatPhone },
              { key: 'alternative_email', label: 'Work Phone', placeholder: 'xxx-xxx-xxxx', format: formatPhone },
              { key: 'address', label: 'Office / Department', placeholder: '123 Main St, Apt 4B, New York, NY 10001', format: formatAddress },
              { key: 'title', label: 'Official Title', placeholder: 'e.g. Lab Manager' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                <input type="text" value={contactForm[field.key] || ''} placeholder={field.placeholder || ''}
                  onChange={e => setContactForm(p => ({ ...p, [field.key]: field.format ? field.format(e.target.value) : e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsibilities</label>
              <textarea value={contactForm.notes || ''} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. IRB submissions, grant reporting, equipment repairs..."
                rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowContactForm(false); setContactForm(EMPTY_CONTACT); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleSaveContact} disabled={saving} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontWeight: 600 }}>
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '400px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            {pwSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#27AE60', margin: 0 }}>Password updated for {passwordTarget.full_name}</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>Set Password</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Set a new password for <strong>{passwordTarget.full_name}</strong>. Their active sessions won't be affected — the new password takes effect on next login.
                </p>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Password</label>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPwError(''); }}
                    placeholder="Min. 8 characters"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                    style={{ width: '100%', padding: '10px 40px 10px 12px', border: `1px solid ${pwError ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {pwError && <p style={{ fontSize: '12px', color: 'var(--danger)', margin: '0 0 12px' }}>{pwError}</p>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button onClick={() => { setPasswordTarget(null); setNewPassword(''); setShowPw(false); setPwError(''); }}
                    style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleChangePassword} disabled={pwSaving || !newPassword}
                    style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: pwSaving || !newPassword ? 'var(--border)' : 'var(--purple-primary)', color: pwSaving || !newPassword ? 'var(--text-muted)' : 'white', fontWeight: 600, cursor: pwSaving || !newPassword ? 'default' : 'pointer' }}>
                    {pwSaving ? 'Saving…' : 'Set Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '580px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Team Member</h2>

            {/* Account */}
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Account</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              {[{ key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' }].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                  <input type="text" value={memberForm[f.key] || ''} onChange={e => setMemberForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work Email</label>
                <input type="email" value={memberForm.email || ''} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showFormPw ? 'text' : 'password'} value={memberForm.password || ''} onChange={e => setMemberForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                    style={{ width: '100%', padding: '8px 36px 8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  <button type="button" onClick={() => setShowFormPw(v => !v)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {showFormPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {memberForm.password && memberForm.password.length < 8 && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--danger)' }}>{memberForm.password.length}/8 characters</p>
                )}
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['admin', 'pm', 'member', 'intern'].map(role => (
                  <button key={role} type="button" onClick={() => setDefaultPermissions(role)} style={{
                    flex: 1, padding: '8px', borderRadius: 'var(--radius-md)',
                    border: `2px solid ${memberForm.role === role ? (ROLE_COLORS[role]?.border || 'var(--purple-primary)') : 'var(--border)'}`,
                    background: memberForm.role === role ? (ROLE_COLORS[role]?.bg || 'var(--purple-faint)') : 'transparent',
                    color: memberForm.role === role ? (ROLE_COLORS[role]?.text || 'var(--purple-primary)') : 'var(--text-secondary)',
                    fontWeight: memberForm.role === role ? 600 : 400, fontSize: '12px', cursor: 'pointer'
                  }}>{ROLE_LABELS[role]}</button>
                ))}
              </div>
            </div>

            {/* Contact Details */}
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>Contact Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Email</label>
                <input type="email" value={memberForm.personal_email || ''} onChange={e => setMemberForm(p => ({ ...p, personal_email: e.target.value }))} placeholder="name@gmail.com"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
                <input type="text" value={memberForm.phone || ''} onChange={e => setMemberForm(p => ({ ...p, phone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</label>
                <input type="text" value={memberForm.title || ''} onChange={e => setMemberForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. PhD Student"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</label>
                <input type="text" value={memberForm.address || ''} onChange={e => setMemberForm(p => ({ ...p, address: e.target.value }))} onBlur={e => setMemberForm(p => ({ ...p, address: formatAddress(e.target.value) }))} placeholder="123 Main St, Apt 4B…"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Emergency Contact */}
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>Emergency Contact <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {[
                { key: 'emergency_contact_name', label: 'Name', ph: 'Jane Doe' },
                { key: 'emergency_contact_relationship', label: 'Relationship', ph: 'e.g. Parent' },
                { key: 'emergency_contact_phone', label: 'Phone', ph: 'xxx-xxx-xxxx', fmt: formatPhone },
                { key: 'emergency_contact_email', label: 'Email', ph: 'name@example.com' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                  <input type="text" value={memberForm[f.key] || ''} placeholder={f.ph}
                    onChange={e => setMemberForm(p => ({ ...p, [f.key]: f.fmt ? f.fmt(e.target.value) : e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            {/* Permissions */}
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>Permissions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
              {PERMISSIONS.map(perm => (
                <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{perm.label}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{perm.description}</p>
                  </div>
                  <button type="button" onClick={() => setMemberForm(p => ({ ...p, [perm.key]: !p[perm.key] }))}
                    style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', background: memberForm[perm.key] ? 'var(--purple-primary)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s ease', flexShrink: 0 }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: memberForm[perm.key] ? '21px' : '3px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
                </div>
              ))}
            </div>

            {memberError && (
              <div style={{ padding: '10px 14px', background: '#FEF0F0', border: '1px solid #FADBD8', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>
                {memberError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowMemberForm(false); setMemberForm(EMPTY_MEMBER); setMemberError(''); setShowFormPw(false); }}
                style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              {(() => {
                const isDisabled = saving || !memberForm.first_name || !memberForm.last_name || !memberForm.email || !memberForm.password || memberForm.password.length < 8;
                return (
                  <button type="button" onClick={handleAddMember} disabled={isDisabled}
                    style={{
                      padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                      background: isDisabled ? 'var(--border)' : 'var(--purple-primary)',
                      color: isDisabled ? 'var(--text-muted)' : 'white',
                      fontWeight: 600, cursor: isDisabled ? 'not-allowed' : 'pointer'
                    }}>{saving ? 'Creating…' : 'Create Member'}</button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
