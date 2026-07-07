import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Edit2, Trash2, Phone, Mail,
  Shield,
  ChevronDown, ChevronUp, Search
} from 'lucide-react';

const ROLE_ORDER = { admin: 1, pm: 2, member: 3, intern: 4 };
const ROLE_LABELS = { admin: 'Supervisor', pm: 'Program Manager', member: 'Lab Member', intern: 'Intern', external: 'NYU Contact' };
const ROLE_COLORS = {
  admin:    { bg: '#F5EEF8', text: '#7B3FA0', border: '#D7BDE2' },
  pm:       { bg: '#EBF5FB', text: '#2980B9', border: '#AED6F1' },
  member:   { bg: '#EAF7F0', text: '#27AE60', border: '#A9DFBF' },
  intern:   { bg: '#FEF9E7', text: '#F39C12', border: '#FAD7A0' },
  external: { bg: '#F2F3F4', text: '#5D6D7E', border: '#CCD1D1' },
};

const PERMISSIONS = [
  { key: 'can_assign_tasks', label: 'Assign Tasks', description: 'Can assign recurring and sporadic tasks' },
  { key: 'can_approve_sporadic', label: 'Approve Task Requests', description: 'Can approve or deny sporadic task requests' },
  { key: 'can_edit_meetings', label: 'Edit Meeting Presenter', description: 'Can change who presents at lab meetings' },
  { key: 'can_view_finance', label: 'View Finance', description: 'Can see grants, orders and reagents' },
  { key: 'can_edit_samples', label: 'Edit Sample Inventory', description: 'Can add, edit and remove samples' },
  { key: 'can_view_contacts', label: 'View Lab Contacts', description: 'Can see the full contact directory' },
  { key: 'can_add_members', label: 'Add Team Members', description: 'Can add new members to the platform' },
];

const EMPTY_CONTACT = {
  first_name: '', last_name: '', role: 'member', title: '', phone: '', email: '',
  alternative_email: '', address: '', supervisor: '', supervisor_email: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '',
  emergency_contact_relationship: '', status: 'active', sort_order: 99, notes: ''
};

const EMPTY_MEMBER = {
  full_name: '', email: '', role: 'member',
  can_assign_tasks: false, can_approve_sporadic: false,
  can_edit_meetings: false, can_view_finance: true,
  can_edit_samples: true, can_view_contacts: false, can_add_members: false
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
  if (contact.first_name || contact.last_name) {
    return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  }
  return contact.full_name || '';
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
      <tr style={{ borderTop: '1px solid var(--border)', background: expanded ? 'rgba(123,63,160,0.04)' : rowIndex % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: roleColors.bg, border: `2px solid ${roleColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: roleColors.text }}>{(contact.first_name || contact.full_name || '?').charAt(0).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{getDisplayName(contact)}</span>
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
          {contact.email ? <a href={`mailto:${contact.email}`} style={{ color: 'var(--purple-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} />{contact.email}</a> : '—'}
        </td>
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {contact.phone ? <a href={`tel:${contact.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{contact.phone}</a> : '—'}
          </td>
        )}
        <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {contact.alternative_email ? <a href={`tel:${contact.alternative_email}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{contact.alternative_email}</a> : '—'}
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>{contact.address || '—'}</td>
        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '200px' }}>{contact.notes || '—'}</td>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={labelStyle}>Email</label>{inp('email', 'name@example.com')}</div>
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

// Each lab member row fetches its own contact data by full_name — completely isolated
function LabMemberRow({ member, canManage, canViewPersonalPhone, userId, onUpdatePermissions, onUpdateRole, onDelete, rowIndex }) {
  const [extraData, setExtraData] = useState(null);
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [form, setForm] = useState({
    phone: '', address: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    emergency_contact_email: '', emergency_contact_relationship: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const roleColors = ROLE_COLORS[member.role] || ROLE_COLORS.member;

  useEffect(() => { loadExtra(); }, []); // eslint-disable-line

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
      address: extraData?.address || '',
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
        address: form.address || '',
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
      <tr style={{ borderTop: '1px solid var(--border)', background: rowIndex % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: roleColors.bg, border: `2px solid ${roleColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: roleColors.text }}>{member.full_name?.charAt(0).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.full_name}</span>
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
          {member.email ? <a href={`mailto:${member.email}`} style={{ color: 'var(--purple-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} />{member.email}</a> : '—'}
        </td>
        <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {extraData?.phone ? <a href={`tel:${extraData.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{extraData.phone}</a> : '—'}
        </td>
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
            {extraData?.emergency_contact_name ? (
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{extraData.emergency_contact_name}{extraData.emergency_contact_relationship ? ` (${extraData.emergency_contact_relationship})` : ''}</div>
                {extraData.emergency_contact_phone && <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><Phone size={10} />{extraData.emergency_contact_phone}</div>}
                {extraData.emergency_contact_email && <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Mail size={10} />{extraData.emergency_contact_email}</div>}
              </div>
            ) : '—'}
          </td>
        )}
        {canViewPersonalPhone && (
          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {extraData?.address || '—'}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inpStyle} type="text" value={form.phone || ''} placeholder="xxx-xxx-xxxx"
                  onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))} />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input style={inpStyle} type="text" value={form.address || ''} placeholder="123 Main St, Apt 4B..."
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  onBlur={e => setForm(p => ({ ...p, address: formatAddress(e.target.value) }))} />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
              {PERMISSIONS.map(perm => (
                <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{perm.label}</p>
                  </div>
                  <button onClick={() => onUpdatePermissions(member.id, perm.key, !member[perm.key])}
                    style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: member[perm.key] ? 'var(--purple-primary)' : 'var(--border)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: member[perm.key] ? '19px' : '3px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
                </div>
              ))}
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
  const [activeTab, setActiveTab] = useState('admin');
  const [showContactForm, setShowContactForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER);
  const [saving, setSaving] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [confirmDeleteMember, setConfirmDeleteMember] = useState(null);

  const canManage = userRole === 'admin' || (permissions?.can_add_members);
  const canViewPersonalPhone = userRole === 'admin' || userRole === 'pm' || profile?.full_name?.toLowerCase().startsWith('mia');

  function logAuthEvent(event_type, fields = {}) {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, ...fields }),
    }).catch(() => {});
  }

  useEffect(() => { fetchData(); }, []);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    const [{ data: contactData }, { data: memberData }] = await Promise.all([
      supabase.from('lab_contacts').select('*').order('sort_order').order('last_name').order('first_name'),
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
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/members/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberForm.email,
          fullName: memberForm.full_name,
          role: memberForm.role,
          invitedById: userId,
          invitedByName: profile?.full_name,
          permissions: {
            can_assign_tasks: memberForm.can_assign_tasks,
            can_approve_sporadic: memberForm.can_approve_sporadic,
            can_edit_meetings: memberForm.can_edit_meetings,
            can_view_finance: memberForm.can_view_finance,
            can_edit_samples: memberForm.can_edit_samples,
            can_view_contacts: memberForm.can_view_contacts,
            can_add_members: memberForm.can_add_members,
          }
        })
      });
      const result = await res.json();
      if (!res.ok) {
        setMemberError(result.error || 'Failed to send invite');
        setSaving(false);
        return;
      }
      setShowMemberForm(false);
      setMemberForm(EMPTY_MEMBER);
      fetchData();
    } catch (err) {
      setMemberError('Network error — please try again');
      console.error('Invite error:', err);
    }
    setSaving(false);
  }

  async function handleUpdatePermissions(memberId, key, value) {
    await supabase.from('profiles').update({ [key]: value }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, [key]: value } : m));
  }

  async function handleUpdateRole(memberId, role) {
    const defaults = {
      admin: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: true, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true },
      pm: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true },
      member: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: false, can_add_members: false },
      intern: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: false, can_edit_samples: true, can_view_contacts: false, can_add_members: false },
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

  function setDefaultPermissions(role) {
    const defaults = {
      admin: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: true, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true },
      pm: { can_assign_tasks: true, can_approve_sporadic: true, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: true, can_add_members: true },
      member: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: true, can_edit_samples: true, can_view_contacts: false, can_add_members: false },
      intern: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: false, can_edit_samples: true, can_view_contacts: false, can_add_members: false },
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
    await supabase.from('lab_contacts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', contactId);
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

  const memberNames = new Set(members.map(m => m.full_name?.toLowerCase().trim()).filter(Boolean));
  const sortedMembers = [...members].sort((a, b) => (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99));

  const filteredAdminContacts = contacts.filter(c => {
    if (c.role !== 'external') return false;
    if (!adminSearch) return true;
    const q = adminSearch.toLowerCase();
    return [getDisplayName(c), c.title, c.email, c.phone, c.notes, c.role, c.address]
      .some(v => v?.toLowerCase().includes(q));
  });

  const filteredLabMembers = sortedMembers.filter(m => {
    if (!labSearch) return true;
    const q = labSearch.toLowerCase();
    return [m.full_name, m.email, ROLE_LABELS[m.role]].some(v => v?.toLowerCase().includes(q));
  });

  const pendingLabContacts = contacts.filter(c => {
    if (c.role === 'external') return false;
    if (memberNames.has(getDisplayName(c).toLowerCase().trim())) return false;
    if (!labSearch) return true;
    const q = labSearch.toLowerCase();
    return [getDisplayName(c), c.email, c.phone, c.address, c.emergency_contact_name].some(v => v?.toLowerCase().includes(q));
  });

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Contacts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Team directory and member management</p>
        </div>
        {canManage && activeTab === 'admin' && (
          <button onClick={() => { setContactForm(EMPTY_CONTACT); setShowContactForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
          }}><Plus size={16} /> Add Contact</button>
        )}
        {canManage && activeTab === 'lab' && (
          <button onClick={() => { setMemberForm(EMPTY_MEMBER); setShowMemberForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
          }}><Plus size={16} /> Add Member</button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width: 'fit-content', marginBottom: '20px' }}>
        {[{ id: 'admin', label: 'Admin Contacts' }, { id: 'lab', label: 'Lab Contacts' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 20px', background: activeTab === tab.id ? 'var(--purple-primary)' : 'transparent', color: activeTab === tab.id ? 'white' : 'var(--text-secondary)', border: 'none', fontWeight: activeTab === tab.id ? 600 : 400, fontSize: '13px', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
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
                      'Name', 'Email', ...(canViewPersonalPhone ? ['Personal Phone'] : []),
                      'Work Phone', 'Office / Dept', 'Responsibilities',
                      ...(canManage ? [''] : [])
                    ].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAdminContacts.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No admin contacts yet.</td></tr>
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
                      'First / Last Name', 'Email', 'Phone Number',
                      ...(canViewPersonalPhone ? ['Emergency Contact'] : []),
                      ...(canViewPersonalPhone ? ['Address'] : []),
                      ...(canManage ? [''] : [])
                    ].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLabMembers.length === 0 && pendingLabContacts.length === 0 ? (
                    <tr><td colSpan={canManage ? 6 : 4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No lab contacts found.</td></tr>
                  ) : filteredLabMembers.map((member, i) => (
                    <LabMemberRow
                      key={member.id}
                      member={member}
                      canManage={canManage}
                      canViewPersonalPhone={canViewPersonalPhone}
                      userId={userId}
                      onUpdatePermissions={handleUpdatePermissions}
                      onUpdateRole={handleUpdateRole}
                      onDelete={setConfirmDeleteMember}
                      rowIndex={i}
                    />
                  ))}
                  {pendingLabContacts.map((c, i) => (
                    <AdminContactRow
                      key={c.id}
                      contact={c}
                      canManage={canManage}
                      canViewPersonalPhone={canViewPersonalPhone}
                      onUpdate={updateAdminContact}
                      onDelete={handleDeleteContact}
                      rowIndex={filteredLabMembers.length + i}
                    />
                  ))}
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
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Contact</h2>

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
              { key: 'email', label: 'Email', placeholder: 'name@example.com' },
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

      {/* Add Member Modal */}
      {showMemberForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '560px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Team Member</h2>

            {memberError && (
              <div style={{ padding: '10px 14px', background: '#FEF0F0', border: '1px solid #FADBD8', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
                {memberError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { key: 'full_name', label: 'Full Name', full: true },
                { key: 'email', label: 'Email', type: 'email' },
              ].map(field => (
                <div key={field.key} style={{ gridColumn: field.full ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                  <input type={field.type || 'text'} value={memberForm[field.key] || ''}
                    onChange={e => setMemberForm(p => ({ ...p, [field.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['admin', 'pm', 'member', 'intern'].map(role => (
                    <button key={role} onClick={() => setDefaultPermissions(role)} style={{
                      flex: 1, padding: '8px', borderRadius: 'var(--radius-md)',
                      border: `2px solid ${memberForm.role === role ? (ROLE_COLORS[role]?.border || 'var(--purple-primary)') : 'var(--border)'}`,
                      background: memberForm.role === role ? (ROLE_COLORS[role]?.bg || 'var(--purple-faint)') : 'transparent',
                      color: memberForm.role === role ? (ROLE_COLORS[role]?.text || 'var(--purple-primary)') : 'var(--text-secondary)',
                      fontWeight: memberForm.role === role ? 600 : 400, fontSize: '12px', cursor: 'pointer'
                    }}>{ROLE_LABELS[role]}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permissions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PERMISSIONS.map(perm => (
                  <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{perm.label}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{perm.description}</p>
                    </div>
                    <button onClick={() => setMemberForm(p => ({ ...p, [perm.key]: !p[perm.key] }))}
                      style={{
                        width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                        background: memberForm[perm.key] ? 'var(--purple-primary)' : 'var(--border)',
                        cursor: 'pointer', position: 'relative', transition: 'background 0.2s ease', flexShrink: 0
                      }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                        position: 'absolute', top: '3px',
                        left: memberForm[perm.key] ? '21px' : '3px',
                        transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowMemberForm(false); setMemberForm(EMPTY_MEMBER); setMemberError(''); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddMember} disabled={saving || !memberForm.full_name || !memberForm.email} style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                background: saving || !memberForm.full_name || !memberForm.email ? 'var(--border)' : 'var(--purple-primary)',
                color: saving || !memberForm.full_name || !memberForm.email ? 'var(--text-muted)' : 'white',
                fontWeight: 600
              }}>{saving ? 'Sending...' : 'Send Invite'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
