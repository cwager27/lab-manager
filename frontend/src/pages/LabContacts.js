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
  full_name: '', email: '', role: 'member', password: '',
  can_assign_tasks: false, can_approve_sporadic: false,
  can_edit_meetings: false, can_view_finance: true,
  can_edit_samples: true, can_view_contacts: false, can_add_members: false
};

function getDisplayName(contact) {
  if (contact.first_name || contact.last_name) {
    return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  }
  return contact.full_name || '';
}

export default function LabContacts({ userRole, userId, profile, permissions }) {
  const [contacts, setContacts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminSearch, setAdminSearch] = useState('');
  const [labSearch, setLabSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER);
  const [saving, setSaving] = useState(false);

  const canManage = userRole === 'admin' || (permissions?.can_add_members);
  const canViewEmergency = userRole === 'pm' || profile?.full_name?.toLowerCase().startsWith('mia');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: contactData }, { data: memberData }] = await Promise.all([
      supabase.from('lab_contacts').select('*').order('sort_order').order('last_name').order('first_name'),
      supabase.from('profiles').select('*').order('full_name')
    ]);
    setContacts(contactData || []);
    setMembers(memberData || []);
    setLoading(false);
  }

  async function handleSaveContact(e) {
    e.preventDefault();
    setSaving(true);
    if (editingContact) {
      await supabase.from('lab_contacts').update({ ...contactForm, updated_at: new Date().toISOString() }).eq('id', editingContact.id);
    } else {
      await supabase.from('lab_contacts').insert([contactForm]);
    }
    setSaving(false);
    setShowContactForm(false);
    setEditingContact(null);
    setContactForm(EMPTY_CONTACT);
    fetchData();
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
    try {
      const { data: authData } = await supabase.auth.admin?.createUser({
        email: memberForm.email,
        password: memberForm.password,
        email_confirm: true
      });

      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberForm.email,
          fullName: memberForm.full_name,
          password: memberForm.password,
          role: memberForm.role
        })
      });

      await supabase.from('profiles').insert([{
        id: authData?.user?.id,
        email: memberForm.email,
        full_name: memberForm.full_name,
        role: memberForm.role,
        can_assign_tasks: memberForm.can_assign_tasks,
        can_approve_sporadic: memberForm.can_approve_sporadic,
        can_edit_meetings: memberForm.can_edit_meetings,
        can_view_finance: memberForm.can_view_finance,
        can_edit_samples: memberForm.can_edit_samples,
        can_view_contacts: memberForm.can_view_contacts,
        can_add_members: memberForm.can_add_members,
      }]);

      setShowMemberForm(false);
      setMemberForm(EMPTY_MEMBER);
      fetchData();
    } catch (err) {
      console.error('Add member error:', err);
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
    await supabase.from('profiles').update({ role, ...defaults[role] }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role, ...defaults[role] } : m));
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

  const memberEmails = new Set(members.map(m => m.email?.toLowerCase()).filter(Boolean));
  const sortedMembers = [...members].sort((a, b) => (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99));

  const filteredAdminContacts = contacts.filter(c => {
    if (c.email && memberEmails.has(c.email.toLowerCase())) return false;
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

  const colStyle = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  };

  const colHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Contacts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Team directory and member management</p>
        </div>
        {canManage && (
          <button onClick={() => { setContactForm(EMPTY_CONTACT); setEditingContact(null); setShowContactForm(true); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
            background: 'var(--purple-primary)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
          }}><Plus size={16} /> Add Contact</button>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* LEFT — Admin Contacts */}
        <div style={colStyle}>
          <div style={colHeaderStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Admin Contacts</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="Search admin contacts..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : filteredAdminContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
              No admin contacts yet.
            </div>
          ) : (
            filteredAdminContacts.map(contact => {
              const roleColors = ROLE_COLORS[contact.role] || ROLE_COLORS.member;
              const isExpanded = expandedId === contact.id;
              return (
                <div key={contact.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                      background: roleColors.bg, border: `2px solid ${roleColors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: roleColors.text }}>
                        {(contact.first_name || contact.full_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{getDisplayName(contact)}</span>
                        <span style={{ padding: '2px 7px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: roleColors.bg, color: roleColors.text, border: `1px solid ${roleColors.border}`, whiteSpace: 'nowrap' }}>
                          {ROLE_LABELS[contact.role] || contact.role}
                        </span>
                      </div>
                      {contact.title && <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{contact.title}</p>}
                      {contact.notes && <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{contact.notes}</p>}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--purple-primary)', textDecoration: 'none' }}>
                            <Mail size={11} /> {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                            <Phone size={11} /> {contact.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => { setEditingContact(contact); setContactForm(contact); setShowContactForm(true); }} style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDeleteContact(contact.id)} style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : contact.id)} style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && canManage && (
                    <div style={{ padding: '14px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {contact.alternative_email && (
                        <div>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Alternative Email</p>
                          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{contact.alternative_email}</p>
                        </div>
                      )}
                      {contact.address && (
                        <div>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Address</p>
                          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{contact.address}</p>
                        </div>
                      )}
                      {(contact.supervisor || contact.supervisor_email) && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Supervisor</p>
                          {contact.supervisor && <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 2px', fontWeight: 600 }}>{contact.supervisor}</p>}
                          {contact.supervisor_email && <a href={`mailto:${contact.supervisor_email}`} style={{ fontSize: '12px', color: 'var(--purple-primary)', textDecoration: 'none' }}>{contact.supervisor_email}</a>}
                        </div>
                      )}
                      {canViewEmergency && contact.emergency_contact_name && (
                        <div style={{ gridColumn: '1 / -1', background: '#FEF9E7', borderRadius: 'var(--radius-sm)', padding: '12px', border: '1px solid #FAD7A0' }}>
                          <p style={{ fontSize: '11px', color: '#F39C12', margin: '0 0 6px', textTransform: 'uppercase', fontWeight: 600 }}>Emergency Contact</p>
                          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 2px', fontWeight: 600 }}>{contact.emergency_contact_name}</p>
                          {contact.emergency_contact_relationship && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>{contact.emergency_contact_relationship}</p>}
                          {contact.emergency_contact_phone && <a href={`tel:${contact.emergency_contact_phone}`} style={{ display: 'block', fontSize: '12px', color: 'var(--purple-primary)', textDecoration: 'none', marginBottom: '2px' }}>{contact.emergency_contact_phone}</a>}
                          {contact.emergency_contact_email && <a href={`mailto:${contact.emergency_contact_email}`} style={{ fontSize: '12px', color: 'var(--purple-primary)', textDecoration: 'none' }}>{contact.emergency_contact_email}</a>}
                        </div>
                      )}
                      {contact.notes && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Notes</p>
                          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, fontStyle: 'italic' }}>{contact.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT — Lab Members */}
        <div style={colStyle}>
          <div style={colHeaderStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Lab Contacts</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={labSearch} onChange={e => setLabSearch(e.target.value)} placeholder="Search lab contacts..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent' }} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : filteredLabMembers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
              No lab contacts found.
            </div>
          ) : (
            filteredLabMembers.map(member => {
              const roleColors = ROLE_COLORS[member.role] || ROLE_COLORS.member;
              const isExpanded = expandedId === member.id;
              return (
                <div key={member.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                      background: roleColors.bg, border: `2px solid ${roleColors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: roleColors.text }}>
                        {member.full_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.full_name}</span>
                        {canManage && member.id !== userId ? (
                          <select value={member.role} onChange={e => handleUpdateRole(member.id, e.target.value)}
                            style={{ padding: '2px 7px', borderRadius: '12px', border: `1px solid ${roleColors.border}`, background: roleColors.bg, color: roleColors.text, fontSize: '11px', fontWeight: 600, outline: 'none' }}>
                            <option value="admin">Supervisor</option>
                            <option value="pm">Program Manager</option>
                            <option value="member">Lab Member</option>
                            <option value="intern">Intern</option>
                          </select>
                        ) : (
                          <span style={{ padding: '2px 7px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: roleColors.bg, color: roleColors.text, border: `1px solid ${roleColors.border}` }}>
                            {ROLE_LABELS[member.role] || member.role}
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <a href={`mailto:${member.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--purple-primary)', textDecoration: 'none' }}>
                          <Mail size={11} /> {member.email}
                        </a>
                      )}
                    </div>
                    {canManage && member.id !== userId && (
                      <button onClick={() => setExpandedId(isExpanded ? null : member.id)} style={{
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                        background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', flexShrink: 0
                      }}>
                        <Shield size={12} /> Permissions {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  {isExpanded && canManage && (
                    <div style={{ padding: '14px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permission Toggles</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {PERMISSIONS.map(perm => (
                          <div key={perm.key} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'
                          }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{perm.label}</p>
                              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{perm.description}</p>
                            </div>
                            <button onClick={() => handleUpdatePermissions(member.id, perm.key, !member[perm.key])}
                              style={{
                                width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                                background: member[perm.key] ? 'var(--purple-primary)' : 'var(--border)',
                                cursor: 'pointer', position: 'relative', transition: 'background 0.2s ease', flexShrink: 0
                              }}>
                              <div style={{
                                width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                                position: 'absolute', top: '3px',
                                left: member[perm.key] ? '21px' : '3px',
                                transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                              }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Contact Modal */}
      {showContactForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '480px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{editingContact ? 'Edit Contact' : 'Add Contact'}</h2>

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
              { key: 'title', label: 'Office / Title' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone Number' },
              { key: 'alternative_email', label: 'Alternative Email' },
              { key: 'address', label: 'Address' },
              { key: 'supervisor', label: 'Supervisor Name' },
              { key: 'supervisor_email', label: 'Supervisor Email' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                <input type="text" value={contactForm[field.key] || ''} onChange={e => setContactForm(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ background: '#FEF9E7', borderRadius: 'var(--radius-md)', padding: '14px', border: '1px solid #FAD7A0', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#F39C12', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency Contact</p>
              {[
                { key: 'emergency_contact_name', label: 'Name' },
                { key: 'emergency_contact_relationship', label: 'Relationship' },
                { key: 'emergency_contact_phone', label: 'Phone' },
                { key: 'emergency_contact_email', label: 'Email' },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</label>
                  <input type="text" value={contactForm[field.key] || ''} onChange={e => setContactForm(p => ({ ...p, [field.key]: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What are they helpful for?</label>
              <textarea value={contactForm.notes || ''} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. IRB submissions, grant reporting, equipment repairs..."
                rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowContactForm(false); setEditingContact(null); setContactForm(EMPTY_CONTACT); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { key: 'full_name', label: 'Full Name', full: true },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'password', label: 'Temporary Password', type: 'password' },
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
              <button onClick={() => { setShowMemberForm(false); setMemberForm(EMPTY_MEMBER); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleAddMember} disabled={saving || !memberForm.full_name || !memberForm.email || !memberForm.password} style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                background: saving || !memberForm.full_name || !memberForm.email || !memberForm.password ? 'var(--border)' : 'var(--purple-primary)',
                color: saving || !memberForm.full_name || !memberForm.email || !memberForm.password ? 'var(--text-muted)' : 'white',
                fontWeight: 600
              }}>{saving ? 'Adding...' : 'Add Member & Send Welcome Email'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
