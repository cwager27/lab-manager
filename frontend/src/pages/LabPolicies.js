import { useState, useRef, useEffect, useCallback } from 'react';
import { SectionContextMenu, SubsectionBlock, makeSubsectionHandlers, TableCellContextMenu, useTableCellColors } from '../components/SOPSection';

const purple = 'var(--purple-primary)';

const s = {
  card:  { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2:    { fontSize: 13, fontWeight: 700, color: purple, textDecoration: 'underline', margin: '0 0 14px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  p:     { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li:    { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul:    { paddingLeft: 20, margin: '0 0 8px' },
  ol:    { paddingLeft: 20, margin: '0 0 8px' },
  sub:   { paddingLeft: 16, margin: '4px 0 4px' },
  sub2:  { paddingLeft: 32, margin: '4px 0 4px' },
};

const INITIAL_SECTIONS = [
  { id: 'ibc',           label: 'Work requiring IBC approval',             builtin: true, content: '' },
  { id: 'specimens',     label: 'Work with human specimens',               builtin: true, content: '' },
  { id: 'bio_materials', label: 'Bringing biological materials into the lab', builtin: true, content: '' },
  { id: 'cell_lines',    label: 'Work with cell lines',                    builtin: true, content: '' },
  { id: 'shared',        label: 'Shared reagents',                         builtin: true, content: '' },
  { id: 'cleanliness',   label: 'Policy reminder: Cleanliness & lab order', builtin: true, content: '' },
  { id: 'orders',        label: 'Policy reminder: Order requests',         builtin: true, content: '' },
];

function BuiltinBody({ id }) {
  switch (id) {
    case 'ibc':
      return (
        <>
          <p style={s.p}>The following work <strong>must not start without prior NYU LH IBC approval</strong>: I <strong>must be informed in advance</strong> to confirm approvals are in place or obtain them for any work involving:</p>
          <ul style={s.ul}>
            <li style={s.li}>Recombinant or synthetic nucleic acid molecules including gene transfer
              <ul style={{ ...s.ul, ...s.sub }}>
                <li style={s.li}>i.e., any activity where DNA or RNA is engineered, introduced, modified, or expressed in a biological system</li>
              </ul>
            </li>
            <li style={s.li}>Human or non-human primate cells, tissues, organs, blood, or body fluids</li>
            <li style={s.li}>Human or non-human primate pathogens</li>
            <li style={s.li}>Select agents and toxins (https://www.selectagents.gov/sat/list.htm)</li>
          </ul>
        </>
      );
    case 'specimens':
      return <p style={s.p}>Work with any human specimens obtained from anywhere other than public vendors <strong>cannot begin without Mia's approval</strong> to confirm IRB compliance, including those from biorepositories, collaborators, or any other sources.</p>;
    case 'bio_materials':
      return (
        <>
          <p style={s.p}>Before any biological materials from collaborators enter the lab (human or non-human; DNA/RNA, cell lines, tissues, edited models, etc.), <strong>the following steps must be completed</strong> to ensure NYU Langone compliance and address any MTA requirements:</p>
          <ol style={s.ol}>
            <li style={s.li}><span style={{ color: purple }}>Advance notification:</span> inform both Mia and me before any materials enter the lab.</li>
            <li style={{ ...s.li, marginTop: 4 }}><span style={{ color: purple }}>Packaging and labeling</span> (non-cell line materials): must be boxed or bagged (boxed whenever possible) and clearly labeled with:
              <ol style={{ ...s.ol, ...s.sub, listStyleType: 'upper-alpha' }}>
                <li style={s.li}>Your name</li>
                <li style={s.li}>Source (e.g., provider's name &amp; institution)</li>
                <li style={s.li}>Material description
                  <ol style={{ ...s.ol, ...s.sub2 }}>
                    <li style={s.li}>Species</li>
                    <li style={s.li}>Specify if: tissues, cell types (FACS-sorted cells only otherwise tissue), specimens (eg swab), DNA, RNA</li>
                    <li style={s.li}>Biological source: organ, tissue or cell type (FACS-only) of origin (eg liver, PBMCs, colon resection, nasal swabs)</li>
                    <li style={s.li}>Donor cohort information — cancer, no known disease/condition, exposure study (specifying exposure), other disease/condition (specify)</li>
                    <li style={s.li}>Pathology of the material itself: malignant, benign/non-malignant (not all material from cancer patients is malignant e.g., blood from liver cancer patients), abnormal but not malignant (eg cirrhotic liver)</li>
                  </ol>
                </li>
              </ol>
            </li>
            <li style={{ ...s.li, marginTop: 4 }}><span style={{ color: purple }}>Inventory sheet:</span> All samples <strong>must be accompanied by a detailed inventory sheet</strong>:
              <ul style={{ ...s.ul, ...s.sub }}>
                <li style={s.li}>File name must include your name, source, and material type (matching the box/bag label)</li>
                <li style={s.li}>Long names are acceptable — clarity is the priority</li>
                <li style={s.li}>Each listed sample must be clearly linkable (ID or labeling) to the tubes/materials in the box/bag</li>
              </ul>
            </li>
            <li style={{ ...s.li, marginTop: 4 }}><span style={{ color: purple }}>Copy inside container:</span> A copy of the inventory sheet <strong>must be placed inside the box/bag</strong>.</li>
            <li style={{ ...s.li, marginTop: 4 }}><span style={{ color: purple }}>Storage:</span> Received materials <strong>must not be stored in personal spaces</strong>, I will coordinate storage in <strong>shared –20/–80 °C locations.</strong></li>
          </ol>
        </>
      );
    case 'cell_lines':
      return (
        <ul style={s.ul}>
          <li style={s.li}><span style={{ color: purple }}>New cell lines (from collaborators or repositories)</span>
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}><strong>Inform me</strong> before the cell line enters the lab</li>
              <li style={s.li}>I will coordinate quarantined expansion for 1 week, mycoplasma test and expansion for the lab stocks before work begins.</li>
            </ul>
          </li>
          <li style={{ ...s.li, marginTop: 8 }}><span style={{ color: purple }}>–80°C storage limit (implementation ongoing)</span>
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>–80 °C is <strong>not</strong> a long-term storage solution</li>
              <li style={s.li}>Up to <strong>20 active cell line vials</strong> may be kept in designated –80 °C boxes</li>
              <li style={s.li}>All other stocks <strong>must be moved to liquid nitrogen</strong></li>
            </ul>
          </li>
          <li style={{ ...s.li, marginTop: 8 }}><span style={{ color: purple }}>Moving cell lines to liquid nitrogen (implementation ongoing).</span> Deliver cell lines to me with:
            <ol style={{ ...s.ol, ...s.sub }}>
              <li style={s.li}>Proof of <strong>negative mycoplasma test</strong></li>
              <li style={s.li}>A completed <strong>cell line storage entry sheet</strong></li>
            </ol>
          </li>
        </ul>
      );
    case 'shared':
      return (
        <>
          <p style={s.p}>The following are <strong>not personal items</strong> and must be <strong>stored in specified shared lab locations</strong> (red boxes or Quartzy-defined locations).</p>
          <ul style={s.ul}>
            <li style={s.li}>Antibodies</li>
            <li style={s.li}>Cell lines</li>
            <li style={s.li}>Proteins and enzymes (including restriction enzymes)</li>
            <li style={s.li}>qPCR / RT-PCR reagents</li>
            <li style={s.li}>Vectors / plasmids</li>
            <li style={s.li}>DNA / RNA extraction kits</li>
          </ul>
        </>
      );
    case 'cleanliness':
      return (
        <ul style={s.ul}>
          <li style={s.li}><strong style={{ color: purple }}>Gloves required</strong> in all lab spaces unless just passing through</li>
          <li style={s.li}><strong style={{ color: purple }}>Lab coats mandatory in TC rooms</strong> — no exceptions
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>Applies to all activities, including hoods, microscopy, fridge/freezers, and conversations</li>
            </ul>
          </li>
          <li style={s.li}><strong style={{ color: purple }}>Last user responsibility:</strong> turn off equipment (except bead baths) and TC hoods</li>
        </ul>
      );
    case 'orders':
      return (
        <ul style={s.ul}>
          <li style={s.li}>Requests received by noon Tuesday or Friday are processed by noon the following business day</li>
          <li style={s.li}>Urgent requests require Mia's approval</li>
          <li style={s.li}>Requests without fully and correctly filled 'Notes' section will be returned.</li>
        </ul>
      );
    default: return null;
  }
}

// Uncontrolled contentEditable div that persists content via MutationObserver
function CustomSectionContent({ sectionId, initialContent, onContentChange }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const cbRef = useRef(onContentChange);
  useEffect(() => { cbRef.current = onContentChange; });

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialContent || '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new MutationObserver(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => cbRef.current(el.innerHTML), 600);
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    return () => { observer.disconnect(); clearTimeout(timer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      style={{ outline: 'none', minHeight: 48, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }}
      data-placeholder="Click to start writing..."
    />
  );
}

export default function LabPolicies({ canEdit }) {
  const [sections, setSections] = useState(() => {
    try {
      const saved = localStorage.getItem('lab_policies_toc');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_SECTIONS;
  });

  const [focusId, setFocusId] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, idx }
  const sectionRefs = useRef({});
  const inputRefs = useRef({});
  const saveTimer = useRef(null);

  // Persist section structure (labels + custom section content) to localStorage
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem('lab_policies_toc', JSON.stringify(sections)); } catch {}
    }, 400);
  }, [sections]);

  // Focus newly inserted TOC input after render
  useEffect(() => {
    if (focusId && inputRefs.current[focusId]) {
      inputRefs.current[focusId].focus();
      setFocusId(null);
    }
  }, [focusId, sections]);

  const updateLabel = useCallback((idx, label) => {
    setSections(p => p.map((sec, i) => i === idx ? { ...sec, label } : sec));
  }, []);

  const updateContent = useCallback((id, content) => {
    setSections(p => p.map(sec => sec.id === id ? { ...sec, content } : sec));
  }, []);

  const { addSubsection, deleteSubsection, updateSubsectionContent, updateSubsectionBgColor, updateSectionBgColor } = makeSubsectionHandlers(setSections);

  function addSection(afterIdx) {
    const id = `custom_${Date.now()}`;
    setSections(p => {
      const at = afterIdx + 1;
      return [...p.slice(0, at), { id, label: '', builtin: false, content: '', subsections: [] }, ...p.slice(at)];
    });
    setFocusId(id);
  }

  function deleteSection(idx) {
    setSections(p => p.filter((_, i) => i !== idx));
  }

  function moveSection(idx, dir) {
    setSections(p => {
      const arr = [...p];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  const scrollTo = id => sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  function handleSectionCtx(e, idx) {
    if (!canEdit) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, idx });
  }

  const containerRef = useRef(null);
  const { cellMenu, closeCellMenu, pickCellColor } = useTableCellColors(containerRef, canEdit, 'cell_colors_lab_policies');

  return (
    <div ref={containerRef} onMouseDown={() => setCtxMenu(null)}>
      <p style={{ ...s.p, margin: '0 0 4px' }}>This is your weekly reminder of lab policies. These requirements are not optional and exist to ensure NYU LH compliance and safe, functional lab operations. Please read carefully and follow exactly guidance over any work involving the following:</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px' }}>From: Sarah Wilcox-Adelman — April 2026</p>

      {/* Table of Contents */}
      <div style={s.card}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Table of Contents</p>

        {canEdit ? (
          <div>
            {sections.map((sec, idx) => (
              <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 22, textAlign: 'right', userSelect: 'none', flexShrink: 0 }}>{idx + 1}.</span>
                <input
                  ref={el => { inputRefs.current[sec.id] = el; }}
                  value={sec.label}
                  onChange={e => updateLabel(idx, e.target.value)}
                  placeholder={`Section ${idx + 1} title...`}
                  style={{ flex: 1, border: 'none', borderBottom: '1px solid transparent', outline: 'none', background: 'transparent', fontSize: 13, color: purple, textDecoration: 'underline', cursor: 'text', padding: '2px 0', transition: 'border-color 0.15s' }}
                  onFocus={e => { e.target.style.borderBottomColor = purple; e.target.style.textDecoration = 'none'; }}
                  onBlur={e => { e.target.style.borderBottomColor = 'transparent'; e.target.style.textDecoration = 'underline'; }}
                />
              </div>
            ))}
          </div>
        ) : (
          <ol style={s.ol}>
            {sections.map(sec => (
              <li key={sec.id} style={{ marginBottom: 4 }}>
                <button onClick={() => scrollTo(sec.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: purple, fontSize: 13, textDecoration: 'underline', textAlign: 'left' }}>
                  {sec.label}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Section bodies — right-click (admin/PM) to add/remove sections */}
      {sections.map((sec, idx) => (
        <div
          key={sec.id}
          ref={el => { sectionRefs.current[sec.id] = el; }}
          style={{ ...s.card, background: sec.bgColor || 'var(--bg-card)' }}
          onContextMenu={e => handleSectionCtx(e, idx)}
        >
          {canEdit
            ? <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ ...s.h2, margin: 0, padding: 0, border: 'none', flexShrink: 0 }}>{idx + 1}.</span>
                <input
                  value={sec.label}
                  onChange={e => updateLabel(idx, e.target.value)}
                  placeholder={`Section ${idx + 1}`}
                  style={{ ...s.h2, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', flex: 1, cursor: 'text', boxSizing: 'border-box', display: 'block', margin: 0, padding: 0 }}
                />
              </div>
            : <div style={s.h2}>{idx + 1}. {sec.label || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Section {idx + 1}</span>}</div>
          }
          {sec.builtin
            ? <BuiltinBody id={sec.id} />
            : <CustomSectionContent
                sectionId={sec.id}
                initialContent={sec.content}
                onContentChange={content => updateContent(sec.id, content)}
              />
          }
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
          x={ctxMenu.x}
          y={ctxMenu.y}
          onAddAbove={() => addSection(ctxMenu.idx - 1)}
          onAddBelow={() => addSection(ctxMenu.idx)}
          onAddSubsection={() => addSubsection(sections[ctxMenu.idx]?.id)}
          onChangeBgColor={color => updateSectionBgColor(sections[ctxMenu.idx]?.id, color)}
          onMoveUp={ctxMenu.idx > 0 ? () => moveSection(ctxMenu.idx, -1) : null}
          onMoveDown={ctxMenu.idx < sections.length - 1 ? () => moveSection(ctxMenu.idx, 1) : null}
          onDelete={() => deleteSection(ctxMenu.idx)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
