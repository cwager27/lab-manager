import { useState, useRef, useCallback, useEffect } from 'react';
import { SectionContextMenu, SubsectionBlock, makeSubsectionHandlers, TableCellContextMenu, useTableCellColors } from '../components/SOPSection';

const s = {
  card:   { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h1:     { fontSize: 13, fontWeight: 700, color: 'var(--purple-primary)', textDecoration: 'underline', textTransform: 'uppercase', margin: '0 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  li:     { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 6 },
  italic: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, fontStyle: 'italic', margin: '4px 0 0' },
  plain:  { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '4px 0 0' },
  ol:     { paddingLeft: 24, margin: '0 0 8px' },
  alpha:  { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'lower-alpha' },
  roman:  { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'lower-roman' },
  circle: { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'circle' },
  num:    { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'decimal' },
};

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
  return <div ref={ref} style={{ outline: 'none', minHeight: 48, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }} />;
}

function BuiltinBody({ id }) {
  switch (id) {
    case 'requestor': return (
      <ol style={s.ol}>
        <li style={s.li}>I verified that an equivalent reagent that can be used does not exist in the lab: YES</li>
        <li style={s.li}>Best estimate of amount needed now (numeric value only):</li>
        <li style={s.li}>Units for stated needs (e.g., uL, mL, mg, g, rxn, box of 1000 tips, case of 10×1000 tips, 96-tip rack):</li>
        <li style={s.li}>Likelihood of needing additional quantities in next 3–6 months (High / Low / Not sure):</li>
        <li style={s.li}>I checked alternative vendors and confirm my request is most cost-effective: YES</li>
        <li style={s.li}>
          Requested vendor still required if cheaper alternatives exist (YES / NO):
          <ol style={s.alpha}>
            <li style={s.li}>If YES, explanation:</li>
          </ol>
        </li>
        <li style={s.li}>For orders &gt;$400, I obtained at least 3 vendor quotes to identify the best price and shared them for approval: YES / NA</li>
        <li style={s.li}>
          Will this reagent be used to introduce, modify, express, or propagate genetic material in cells or organisms (including bacteria, yeast, or other microorganisms)? (YES / NO)
          <p style={s.italic}>E.g. plasmids, cloning or expression vectors bacteria cultures used for cloning, CRISPR reagents (Cas proteins, guide RNAs, donor templates), base editors, prime editors, viral delivery systems (lentivirus, AAV, retrovirus, adenovirus), non-viral delivery methods (transfection reagents, electroporation or nucleofection systems), and reporters, tags, or regulatory elements (e.g., GFP, luciferase, FLAG, promoters, enhancers).</p>
        </li>
        <li style={s.li}>
          Does this request introduce NEW biological material into the lab that was not previously present? (YES/NO)
          <p style={s.plain}>E.g., new cell lines of any species, organoids or stem-cell–derived models, primary cells, tissues or tissue-derived material, live or replication-competent biological agents, and engineered or modified biological materials received from collaborators.</p>
        </li>
        <li style={s.li}>All slides from 1:1 and lab/SOF meetings are updated in the shared folder with Mia (YES/NO)</li>
        <li style={s.li}>All slides from 1:1 and lab/SOF meetings are updated with the correct format (yy-mm-dd) (YES/NO)</li>
      </ol>
    );
    case 'lab_manager': return (
      <ol style={s.ol}>
        <li style={s.li}>Last slide deck from the requestor in 1:1 folder: [yy/mm/dd]</li>
        <li style={s.li}>Last slide deck from the requestor in lab meetings folder: [yy/mm/dd]</li>
        <li style={s.li}>Requestor form entered in correct format and is complete: YES</li>
        <li style={s.li}>
          For orders &lt;$400 where specific vendor is not required, I checked alternative products and pricing in (YES = I checked; NO = I didn't check; NA = requested vendor is required, therefore check is not applicable):
          <ol style={s.roman}>
            <li style={s.li}>Google:</li>
            <li style={s.li}>People Soft/eMarketPlace:</li>
            <li style={s.li}>People Soft/ RUSH eMarketPlace:</li>
            <li style={s.li}>People Soft/ Fisher Healthcare:</li>
            <li style={s.li}>People Soft/ Life Technologies:</li>
            <li style={s.li}>People Soft/ Sigma Aldrich:</li>
            <li style={s.li}>People Soft/ Other punchouts if applicable:</li>
          </ol>
        </li>
        <li style={s.li}>If a cheaper vendor was identified, applicability is confirmed by the end user; without assuming suitability: YES / NO / NA (cheaper vendor not identified or requested vendor was required thus search not performed)</li>
        <li style={s.li}>For orders &gt;$400 I verified that at least 3 vendor quotes were obtained: YES (verified) / NO (not verified) / NA (order&lt;$400)</li>
        <li style={s.li}>
          Itinerary search (existence &amp; prior usage)
          <ol style={s.roman}>
            <li style={s.li}>Itinerary searched by catalog number to assess both reagent existence and prior usage: YES/NO</li>
            <li style={s.li}>Itinerary searched by at least 3 key terms (3 entries can be multiple words) including specific terms to capture exact products and less specific words to capture potentially similar functionally relevant reagents to assess both reagent existence and prior usage: YES/NO</li>
            <li style={s.li}>Keywords used (comma-separated): ____________________</li>
            <li style={s.li}>The same or functionally equivalent reagent already in lab: YES / NO</li>
            <li style={s.li}>Prior users identified who have used this in the past (including requestor prior usage): n = ___</li>
          </ol>
        </li>
        <li style={s.li}>
          User need validation
          <ol style={s.roman}>
            <li style={s.li}>All identified users contacted: YES/NO/NA (no other prior users)</li>
            <li style={s.li}>Expected total need over 3 or 6 (select) months is _______</li>
          </ol>
        </li>
        <li style={s.li}>
          Vendor and package size selection if an original order was changed
          <ol style={s.roman}>
            <li style={s.li}>Order is original or changed (delete as appropriate)</li>
            <li style={s.li}>
              If changed:
              <ul style={s.circle}>
                <li style={s.li}>Price-per-unit comparison across vendors performed: YES / NO</li>
                <li style={s.li}>Original Vendor Size/Price: _______</li>
                <li style={s.li}>Selected Vendor Size/Price: _______</li>
                <li style={s.li}>
                  Bigger sizes than selected if available from both select and other 2 cheapest vendors:
                  <ol style={s.num}>
                    <li style={s.li}>(vendor/price or NA): __________</li>
                    <li style={s.li}>(vendor/price or NA): __________</li>
                    <li style={s.li}>(vendor/price or NA): __________</li>
                  </ol>
                </li>
              </ul>
            </li>
            <li style={s.li}>
              Reason for selection (select all that apply):
              <ul style={{ ...s.circle, listStyleType: 'none', paddingLeft: 8 }}>
                <li style={s.li}>☐ Matches expected total need</li>
                <li style={s.li}>☐ Lowest price per unit</li>
                <li style={s.li}>☐ Shelf-life / storage constraints</li>
                <li style={s.li}>☐ Vendor availability / backorder risk</li>
              </ul>
            </li>
          </ol>
        </li>
      </ol>
    );
    default: return null;
  }
}

const INITIAL_SECTIONS = [
  { id: 'requestor',   label: 'Requestor Form',    builtin: true },
  { id: 'lab_manager', label: 'Lab Manager Form',  builtin: true },
];

export default function OrderingSOP({ canEdit }) {
  const [sections, setSections] = useState(() => {
    try {
      const saved = localStorage.getItem('ordering_sections');
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) return p; }
    } catch {}
    return INITIAL_SECTIONS;
  });
  const [ctxMenu, setCtxMenu] = useState(null);
  const inputRefs = useRef({});

  useEffect(() => {
    try { localStorage.setItem('ordering_sections', JSON.stringify(sections)); } catch {}
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
  const { cellMenu, closeCellMenu, pickCellColor } = useTableCellColors(containerRef, canEdit, 'cell_colors_ordering');

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
                    style={{ ...s.h1, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', display: 'block' }} />
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
