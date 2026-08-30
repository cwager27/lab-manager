import { useState, useRef, useCallback, useEffect } from 'react';
import { SectionContextMenu, SubsectionBlock, makeSubsectionHandlers, TableCellContextMenu, useTableCellColors } from '../components/SOPSection';

const purple = '#7030a0';

const s = {
  card:    { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h1:      { fontSize: 15, fontWeight: 700, color: purple, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 4px' },
  sub:     { fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' },
  note:    { fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 10px' },
  label:   { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px' },
  th:      { background: purple, color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700, textAlign: 'left', border: '1px solid #5a1e82', whiteSpace: 'nowrap' },
  td:      { padding: '7px 12px', fontSize: 13, border: '1px solid var(--border)', color: 'var(--text-secondary)', verticalAlign: 'top' },
  tdBold:  { padding: '7px 12px', fontSize: 13, border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, verticalAlign: 'top' },
  tdHl:    { padding: '7px 12px', fontSize: 13, border: '1px solid var(--border)', color: purple, fontWeight: 700, background: '#f0ebf8', verticalAlign: 'top' },
  wrap:    { overflowX: 'auto', marginBottom: 14 },
  ol:      { paddingLeft: 24, margin: '0 0 8px' },
  li:      { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
};

function T({ headers, rows, hlCols = [] }) {
  return (
    <div style={s.wrap}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={s.th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={hlCols.includes(ci) ? s.tdHl : ci === 0 ? s.tdBold : s.td}>
                  {typeof cell === 'string' ? cell.split('\n').map((line, i, arr) => (
                    <span key={i}>{line}{i < arr.length - 1 ? <br /> : null}</span>
                  )) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomSectionContent({ sectionId, initialContent, onContentChange }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const cbRef = useRef(onContentChange);
  useEffect(() => { cbRef.current = onContentChange; });
  useEffect(() => { if (ref.current) ref.current.innerHTML = initialContent || ''; }, []); // eslint-disable-line
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new MutationObserver(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => cbRef.current(el.innerHTML), 600);
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    return () => { observer.disconnect(); clearTimeout(timer.current); };
  }, []); // eslint-disable-line
  return <div ref={ref} contentEditable suppressContentEditableWarning style={{ outline: 'none', minHeight: 48, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }} />;
}

function BuiltinBody({ id }) {
  switch (id) {
    case 'subject_nomenclature': return (
      <>
        <div style={s.sub}>Subject ID format (8 characters): {'{'}Project{'}'}{'{'}XXX{'}'}</div>
        <T headers={['Component', 'Description', 'Example']} rows={[
          ['Project', '5-character unique project code', 'BENZM (Benzene-mouse)\nBENZP (Benzene-prostate VA)\nSKINP (Skin-Petljak IRB)\nSKIND (Skin-Demehri IRB)'],
          ['XXX', '3-digit project-specific subject code', '001'],
        ]} />
        <div style={s.label}>Examples:</div>
        <T headers={['Project', 'XXXX', 'Subject ID']} rows={[
          ['Benzene-mouse', 'Subject 1', 'BENZM001'],
          ['Benzene-mouse', 'Subject 2', 'BENZM002'],
          ['Skin-Petljak',  'Subject 1', 'SKINP001'],
        ]} hlCols={[2]} />
      </>
    );

    case 'sample_nomenclature': return (
      <>
        <div style={s.sub}>SampleID format (12 characters): {'{'}SubjectID{'}'}{'{'}NN{'}'}{'{'}XX{'}'}</div>
        <T headers={['Component', 'Description', 'Example']} rows={[
          ['SubjectID', '8-character SubjectID', 'BENZM001'],
          ['NN', '2-character sample type', 'CS (Cancer Skin)\nSee table below'],
          ['XX', '2-digit subject- and sample type-specific sample code', '01'],
        ]} />
        <div style={s.label}>Sample type table (NN): <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--text-muted)' }}>can be updated as new tissue/cell/cancer types are studied</span></div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead><tr><th style={s.th}>Tissue Type</th><th style={s.th}>Code</th></tr></thead>
              <tbody>
                {[['Skin','TS'],['Whole blood','TB'],['Bone marrow','TM'],['Lung','TL'],['Liver','TV'],['Colon','TC'],['Pancreas','TP'],['Kidney','TK'],['Bladder','TU'],['Oral','TO'],['Toe/Tail','TT'],['Testes','TY'],['Prostate','TR'],['Tongue','TG']].map(([a,b]) => (
                  <tr key={a}><td style={s.tdBold}>{a}</td><td style={s.tdHl}>{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead><tr><th style={s.th}>Cell Type</th><th style={s.th}>Code</th></tr></thead>
              <tbody>
                {[['HSCs','CH'],['Myeloid cell','CM'],['Mye. prog.','CY'],['B cell','CB'],['T cell','CT'],['CD4 T cell','C4'],['CD8 T cell','C8'],['Cord Blood','CF']].map(([a,b]) => (
                  <tr key={a}><td style={s.tdBold}>{a}</td><td style={s.tdHl}>{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead><tr><th style={s.th}>Cancer Type</th><th style={s.th}>Code</th></tr></thead>
              <tbody>
                {[['Skin','KS'],['Lung','KL'],['Liver','KV'],['Colorectal','KC'],['Pancreatic','KP'],['Kidney','KK'],['Brain','KG'],['Esophagus','KE'],['Breast','KB'],['Bladder','KU'],['Leukemia','KA']].map(([a,b]) => (
                  <tr key={a}><td style={s.tdBold}>{a}</td><td style={s.tdHl}>{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={s.label}>Examples:</div>
        <T headers={['SubjectID', 'NN', 'XX', 'SampleID']} rows={[
          ['BENZM001', 'HSCs',        '01', 'BENZM001CH01'],
          ['BENZM001', 'HSCs',        '02', 'BENZM001CH02'],
          ['SKINP001', 'Normal skin', '01', 'SKINP001TS01'],
          ['SKINP001', 'Skin cancer', '01', 'SKINP001KS01'],
        ]} hlCols={[3]} />
      </>
    );

    case 'library_nomenclature': return (
      <>
        <div style={s.sub}>LibraryID format (17 characters): {'{'}SubjectID{'}'}{'{'}SampleID{'}'}_{'{'}P{'}'}{'{'}LLL{'}'}</div>
        <T headers={['Component', 'Description', 'Example']} rows={[
          ['SampleID', '12-character SampleID', 'BENZM001CH01'],
          ['P', '1-character library preparation type', 'G (Bulk WGS)\nSee table below'],
          ['LLL', '3-digit library preparation type-specific code', '001'],
        ]} />
        <div style={s.label}>Library preparation type table:</div>
        <div style={{ marginBottom: 14 }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead><tr><th style={s.th}>Library type (P)</th><th style={s.th}>Code</th></tr></thead>
            <tbody>
              {[['Bulk WGS','G'],['Bulk target capture (inc. WES)','E'],['Nanoseq WGS','N'],['Nanoseq Target','T'],['UDSeq WGS','U'],['UDSeq Target','C'],['HiDefSeq','H'],['Bulk RNA-seq','R'],['Single cell RNA-seq','X'],['Single cell DNA-seq','S']].map(([a,b]) => (
                <tr key={a}><td style={s.tdBold}>{a}</td><td style={s.tdHl}>{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={s.label}>Examples:</div>
        <T headers={['SampleID', 'P', 'LLL', 'LibraryID']} rows={[
          ['BENZM001CH01', 'Nanoseq WGS',    '001', 'BENZM001CH01_N001'],
          ['BENZM001CH02', 'Nanoseq WGS',    '001', 'BENZM001CH02_N001'],
          ['SKINP001TS01', 'Nanoseq Target', '001', 'SKINP001TS01_T001'],
          ['SKINP001KS01', 'WES',            '001', 'SKINP001KS01_E001'],
        ]} hlCols={[3]} />
      </>
    );

    default: return null;
  }
}

const INITIAL_SECTIONS = [
  { id: 'subject_nomenclature', label: 'Subject Nomenclature: Of Mice and (wo)Men', builtin: true },
  { id: 'sample_nomenclature',  label: 'Sample Nomenclature',                       builtin: true },
  { id: 'library_nomenclature', label: 'Library Nomenclature',                      builtin: true },
];

export default function SampleNamingNomenclature({ canEdit }) {
  const [sections, setSections] = useState(() => {
    try {
      const saved = localStorage.getItem('sample_naming_sections');
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) return p; }
    } catch {}
    return INITIAL_SECTIONS;
  });
  const [ctxMenu, setCtxMenu] = useState(null);
  const inputRefs = useRef({});

  useEffect(() => {
    try { localStorage.setItem('sample_naming_sections', JSON.stringify(sections)); } catch {}
  }, [sections]);

  const addSection = useCallback((afterIdx) => {
    const id = `custom_${Date.now()}`;
    setSections(prev => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, { id, label: '', builtin: false, content: '' });
      return next;
    });
  }, []);

  const deleteSection = useCallback((idx) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const moveSection = useCallback((idx, dir) => {
    setSections(prev => {
      const next = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }, []);

  const updateLabel = useCallback((id, label) => {
    setSections(prev => prev.map(sec => sec.id === id ? { ...sec, label } : sec));
  }, []);

  const updateContent = useCallback((id, content) => {
    setSections(prev => prev.map(sec => sec.id === id ? { ...sec, content } : sec));
  }, []);

  const { addSubsection, deleteSubsection, updateSubsectionContent, updateSubsectionBgColor, updateSectionBgColor } = makeSubsectionHandlers(setSections);
  const containerRef = useRef(null);
  const { cellMenu, closeCellMenu, pickCellColor } = useTableCellColors(containerRef, canEdit, 'cell_colors_sample_naming');

  return (
    <div ref={containerRef} onMouseDown={() => setCtxMenu(null)}>
      {sections.map((sec, idx) => (
        <div key={sec.id} style={{ ...s.card, background: sec.bgColor || 'var(--bg-card)' }}
          onContextMenu={canEdit ? e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, idx }); } : undefined}>
          {sec.builtin ? (
            <>
              <div style={s.h1}>{sec.label}</div>
              <BuiltinBody id={sec.id} />
            </>
          ) : (
            <>
              {canEdit
                ? <input ref={el => { inputRefs.current[sec.id] = el; }} value={sec.label} onChange={e => updateLabel(sec.id, e.target.value)} placeholder={`Section ${idx + 1}`}
                    style={{ ...s.h1, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', display: 'block', marginBottom: 12 }} />
                : <div style={s.h1}>{sec.label || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Section {idx + 1}</span>}</div>
              }
              <CustomSectionContent sectionId={sec.id} initialContent={sec.content} onContentChange={content => updateContent(sec.id, content)} />
            </>
          )}
          {(sec.subsections || []).map(sub => (
            <SubsectionBlock key={sub.id} sub={sub} canEdit={canEdit}
              onContentChange={content => updateSubsectionContent(sec.id, sub.id, content)}
              onChangeBgColor={color => updateSubsectionBgColor(sec.id, sub.id, color)}
              onDelete={() => deleteSubsection(sec.id, sub.id)} />
          ))}
        </div>
      ))}

      {cellMenu && <TableCellContextMenu x={cellMenu.x} y={cellMenu.y} onPickColor={pickCellColor} onClose={closeCellMenu} />}
      {ctxMenu && (
        <SectionContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onAddAbove={() => addSection(ctxMenu.idx - 1)}
          onAddBelow={() => addSection(ctxMenu.idx)}
          onMoveUp={ctxMenu.idx > 0 ? () => moveSection(ctxMenu.idx, -1) : null}
          onMoveDown={ctxMenu.idx < sections.length - 1 ? () => moveSection(ctxMenu.idx, 1) : null}
          onDelete={!sections[ctxMenu.idx]?.builtin ? () => deleteSection(ctxMenu.idx) : null}
          onAddSubsection={() => addSubsection(sections[ctxMenu.idx]?.id)}
          onChangeBgColor={color => updateSectionBgColor(sections[ctxMenu.idx]?.id, color)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
