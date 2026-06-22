import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, Plus, Trash2, Edit2, ChevronDown, ChevronUp, CheckCircle, XCircle, FileText } from 'lucide-react';

const BINDER_ITEMS = [
  'IRB approval letter present',
  'Consent forms present',
  'Protocol document present',
  'Personnel list up to date',
  'Adverse event reports filed',
  'Annual renewal submitted',
  'Any modifications approved'
];

export default function StudiesTab({ studies, members, canManage, showStudyForm, setShowStudyForm, editingStudy, setEditingStudy, studyForm, setStudyForm, onSave, onDelete, onCertUpload, userId, fetchStudies }) {
  const [expandedStudy, setExpandedStudy] = useState(null);
  const [binderChecks, setBinderChecks] = useState({});
  const [studySamples, setStudySamples] = useState({});
  const [studyFiles, setStudyFiles] = useState({});
  const [showSampleForm, setShowSampleForm] = useState(null);
  const [sampleForm, setSampleForm] = useState({ sample_id: '', sample_type: '', date_collected: '', status: 'active', notes: '' });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingApprovedWork, setSavingApprovedWork] = useState(false);
  const [approvedWorkText, setApprovedWorkText] = useState({});

  async function loadStudyDetails(studyId) {
    const [{ data: checks }, { data: samples }, { data: files }] = await Promise.all([
      supabase.from('study_binder_checks').select('*').eq('study_id', studyId).order('item'),
      supabase.from('study_samples').select('*').eq('study_id', studyId).order('created_at', { ascending: false }),
      supabase.from('study_files').select('*, uploader:profiles!study_files_uploaded_by_fkey(full_name)').eq('study_id', studyId).order('uploaded_at', { ascending: false })
    ]);

    // If no binder checks exist yet, create them
    if (!checks || checks.length === 0) {
      const newChecks = BINDER_ITEMS.map(item => ({ study_id: studyId, item, present: false }));
      const { data: inserted } = await supabase.from('study_binder_checks').insert(newChecks).select();
      setBinderChecks(prev => ({ ...prev, [studyId]: inserted || [] }));
    } else {
      setBinderChecks(prev => ({ ...prev, [studyId]: checks || [] }));
    }

    setStudySamples(prev => ({ ...prev, [studyId]: samples || [] }));
    setStudyFiles(prev => ({ ...prev, [studyId]: files || [] }));
  }

  async function toggleExpand(studyId) {
    if (expandedStudy === studyId) {
      setExpandedStudy(null);
    } else {
      setExpandedStudy(studyId);
      await loadStudyDetails(studyId);
    }
  }

  async function toggleBinderCheck(checkId, studyId, current) {
    await supabase.from('study_binder_checks').update({ present: !current, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', checkId);
    await loadStudyDetails(studyId);
  }

  async function handleAddSample(studyId) {
    await supabase.from('study_samples').insert([{ ...sampleForm, study_id: studyId, created_by: userId }]);
    setShowSampleForm(null);
    setSampleForm({ sample_id: '', sample_type: '', date_collected: '', status: 'active', notes: '' });
    await loadStudyDetails(studyId);
  }

  async function handleDeleteSample(sampleId, studyId) {
    if (window.confirm('Remove this sample?')) {
      await supabase.from('study_samples').delete().eq('id', sampleId);
      await loadStudyDetails(studyId);
    }
  }

  async function handleFileUpload(studyId, file) {
    if (!file) return;
    setUploadingFile(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `study-files/${studyId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      await supabase.from('study_files').insert([{
        study_id: studyId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        uploaded_by: userId
      }]);
      await loadStudyDetails(studyId);
    }
    setUploadingFile(false);
  }

  async function handleDeleteFile(fileId, studyId) {
    if (window.confirm('Remove this file?')) {
      await supabase.from('study_files').delete().eq('id', fileId);
      await loadStudyDetails(studyId);
    }
  }

  async function handleSaveApprovedWork(studyId) {
    setSavingApprovedWork(true);
    await supabase.from('compliance_studies').update({ approved_work_text: approvedWorkText[studyId] }).eq('id', studyId);
    setSavingApprovedWork(false);
    fetchStudies();
  }

  async function handleApprovedWorkFileUpload(studyId, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `approved-work/${studyId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('lab-files').upload(path, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(path);
      await supabase.from('compliance_studies').update({ approved_work_url: urlData.publicUrl }).eq('id', studyId);
      fetchStudies();
    }
  }

  return (
    <div>
      {studies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          No studies added yet. Click Add Study to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {studies.map(study => {
            const daysLeft = study.certificate_expiry ? Math.ceil((new Date(study.certificate_expiry) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const isExpiringSoon = daysLeft !== null && daysLeft <= 60;
            const isExpired = daysLeft !== null && daysLeft < 0;
            const teamNames = members.filter(m => (study.team_members || []).includes(m.id)).map(m => m.full_name);
            const isExpanded = expandedStudy === study.id;
            const checks = binderChecks[study.id] || [];
            const missingCount = checks.filter(c => !c.present).length;

            return (
              <div key={study.id} style={{
                background: 'var(--bg-card)', border: `1px solid ${isExpired ? '#FADBD8' : isExpiringSoon ? '#FAD7A0' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
              }}>
                {/* Study Header */}
                <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{study.study_name}</h3>
                      {study.irb_exception ? (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#F2F3F4', color: '#5A5A7A' }}>IRB Exception</span>
                      ) : study.irb_number ? (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#EBF5FB', color: '#2980B9', fontFamily: 'monospace' }}>IRB {study.irb_number}</span>
                      ) : null}
                      {study.tissues_held && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>Tissues Held</span>}
                      {isExpired && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>Cert Expired</span>}
                      {isExpiringSoon && !isExpired && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FEF9E7', color: '#F39C12' }}>Cert Expiring</span>}
                      {isExpanded && missingCount > 0 && <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: '#FDEDEC', color: '#E74C3C' }}>{missingCount} binder item{missingCount > 1 ? 's' : ''} missing</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {study.ilab_exists && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>iLab: {study.ilab_link ? <a href={study.ilab_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple-primary)' }}>Link</a> : 'Yes'}</span>}
                      {study.certificate_expiry && <span style={{ fontSize: '12px', color: isExpired ? '#E74C3C' : isExpiringSoon ? '#F39C12' : 'var(--text-muted)' }}>Certificate expires: {study.certificate_expiry}</span>}
                      {study.certificate_url && <a href={study.certificate_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--purple-primary)' }}>View Certificate</a>}
                      {study.benchling_url && <a href={study.benchling_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#27AE60', fontWeight: 500 }}>📗 Open in Benchling</a>}
                    </div>
                    {teamNames.length > 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 4px' }}>Team: {teamNames.join(', ')}</p>}
                    {study.notes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>{study.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                    <label style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Upload Certificate">
                      <Upload size={14} />
                      <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => onCertUpload(study.id, e.target.files[0])} />
                    </label>
                    <button onClick={() => { setEditingStudy(study); setStudyForm(study); setShowStudyForm(true); }} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => onDelete(study.id)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => toggleExpand(study.id)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: isExpanded ? 'var(--purple-faint)' : 'var(--bg-primary)', color: isExpanded ? 'var(--purple-primary)' : 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Study Details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Approved Work */}
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>Approved Work</h4>
                      <textarea
                        value={approvedWorkText[study.id] !== undefined ? approvedWorkText[study.id] : (study.approved_work_text || '')}
                        onChange={e => setApprovedWorkText(prev => ({ ...prev, [study.id]: e.target.value }))}
                        placeholder="Paste relevant IRB approval language here..."
                        rows={4}
                        style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => handleSaveApprovedWork(study.id)} disabled={savingApprovedWork} style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600 }}>
                          {savingApprovedWork ? 'Saving...' : 'Save'}
                        </button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-primary)', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <Upload size={12} /> Upload Document
                          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleApprovedWorkFileUpload(study.id, e.target.files[0])} />
                        </label>
                        {study.approved_work_url && <a href={study.approved_work_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--purple-primary)' }}>View Document</a>}
                      </div>
                    </div>

                    {/* IRB Binder Checks */}
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>IRB Binder Checklist</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {checks.map(check => (
                          <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: `1px solid ${check.present ? '#A9DFBF' : '#FADBD8'}` }}>
                            <button onClick={() => toggleBinderCheck(check.id, study.id, check.present)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                              {check.present ? <CheckCircle size={16} color="#27AE60" /> : <XCircle size={16} color="#E74C3C" />}
                            </button>
                            <span style={{ fontSize: '13px', color: check.present ? 'var(--text-primary)' : '#E74C3C', flex: 1 }}>{check.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sample Tracker */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Sample Tracker</h4>
                        <button onClick={() => setShowSampleForm(study.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '11px', fontWeight: 600 }}>
                          <Plus size={12} /> Add Sample
                        </button>
                      </div>
                      {showSampleForm === study.id && (
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--purple-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '10px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            {[{ label: 'Sample ID', key: 'sample_id' }, { label: 'Sample Type', key: 'sample_type' }, { label: 'Date Collected', key: 'date_collected', type: 'date' }, { label: 'Notes', key: 'notes' }].map(f => (
                              <div key={f.key} style={{ gridColumn: f.key === 'notes' ? '1/-1' : 'auto' }}>
                                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>{f.label}</label>
                                <input type={f.type || 'text'} value={sampleForm[f.key]} onChange={e => setSampleForm(p => ({ ...p, [f.key]: e.target.value }))}
                                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                              </div>
                            ))}
                            <div>
                              <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Status</label>
                              <select value={sampleForm.status} onChange={e => setSampleForm(p => ({ ...p, status: e.target.value }))}
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none' }}>
                                <option value="active">Active</option>
                                <option value="used">Used</option>
                                <option value="destroyed">Destroyed</option>
                                <option value="stored">Stored</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleAddSample(study.id)} disabled={!sampleForm.sample_id} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '12px', fontWeight: 600 }}>Add</button>
                            <button onClick={() => setShowSampleForm(null)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px' }}>Cancel</button>
                          </div>
                        </div>
                      )}
                      {(studySamples[study.id] || []).length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No samples tracked yet.</p>
                      ) : (
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary)' }}>
                                {['Sample ID', 'Type', 'Date Collected', 'Status', 'Notes', ''].map(h => (
                                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(studySamples[study.id] || []).map(s => (
                                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{s.sample_id}</td>
                                  <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>{s.sample_type}</td>
                                  <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>{s.date_collected}</td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, background: s.status === 'active' ? '#EAF7F0' : '#F2F3F4', color: s.status === 'active' ? '#27AE60' : '#5A5A7A', textTransform: 'capitalize' }}>{s.status}</span>
                                  </td>
                                  <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{s.notes}</td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <button onClick={() => handleDeleteSample(s.id, study.id)} style={{ padding: '3px 6px', fontSize: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}>Delete</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Additional Files */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Additional Files</h4>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--purple-primary)', color: 'white', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          <Upload size={12} /> {uploadingFile ? 'Uploading...' : 'Upload File'}
                          <input type="file" style={{ display: 'none' }} onChange={e => handleFileUpload(study.id, e.target.files[0])} />
                        </label>
                      </div>
                      {(studyFiles[study.id] || []).length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No additional files uploaded yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(studyFiles[study.id] || []).map(f => (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={14} color="var(--purple-primary)" />
                                <div>
                                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--purple-primary)', textDecoration: 'none', fontWeight: 500 }}>{f.file_name}</a>
                                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{f.uploader?.full_name} · {new Date(f.uploaded_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <button onClick={() => handleDeleteFile(f.id, study.id)} style={{ padding: '3px 6px', fontSize: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid #FADBD8', background: '#FEF0F0', color: 'var(--danger)', cursor: 'pointer' }}>Delete</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showStudyForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{editingStudy ? 'Edit Study' : 'Add Study'}</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study Name</label>
              <input value={studyForm.study_name} onChange={e => setStudyForm(p => ({ ...p, study_name: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IRB Number</label>
                <input value={studyForm.irb_number} onChange={e => setStudyForm(p => ({ ...p, irb_number: e.target.value }))}
                  disabled={studyForm.irb_exception}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', opacity: studyForm.irb_exception ? 0.5 : 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={studyForm.irb_exception} onChange={e => setStudyForm(p => ({ ...p, irb_exception: e.target.checked }))} />
                  IRB Exception
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={studyForm.tissues_held} onChange={e => setStudyForm(p => ({ ...p, tissues_held: e.target.checked }))} />
                Tissues Held
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={studyForm.ilab_exists} onChange={e => setStudyForm(p => ({ ...p, ilab_exists: e.target.checked }))} />
                iLab Exists
              </label>
            </div>

            {studyForm.ilab_exists && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>iLab Link</label>
                <input value={studyForm.ilab_link} onChange={e => setStudyForm(p => ({ ...p, ilab_link: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Members</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {members.map(m => {
                  const isSelected = (studyForm.team_members || []).includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => {
                      setStudyForm(p => ({
                        ...p,
                        team_members: isSelected ? p.team_members.filter(id => id !== m.id) : [...(p.team_members || []), m.id]
                      }));
                    }} style={{
                      padding: '6px 12px', borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isSelected ? 'var(--purple-primary)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--purple-faint)' : 'transparent',
                      color: isSelected ? 'var(--purple-primary)' : 'var(--text-secondary)',
                      fontSize: '12px', fontWeight: isSelected ? 600 : 400
                    }}>{m.full_name}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Certificate Expiry Date</label>
              <input type="date" value={studyForm.certificate_expiry || ''} onChange={e => setStudyForm(p => ({ ...p, certificate_expiry: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Benchling URL</label>
              <input value={studyForm.benchling_url || ''} onChange={e => setStudyForm(p => ({ ...p, benchling_url: e.target.value }))}
                placeholder="https://benchling.com/..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
              <textarea value={studyForm.notes || ''} onChange={e => setStudyForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowStudyForm(false); setEditingStudy(null); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
              <button onClick={onSave} disabled={!studyForm.study_name} style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                background: !studyForm.study_name ? 'var(--border)' : 'var(--purple-primary)',
                color: !studyForm.study_name ? 'var(--text-muted)' : 'white', fontWeight: 600
              }}>Save Study</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
