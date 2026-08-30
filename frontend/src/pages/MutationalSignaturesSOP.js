import { useState, useRef, useCallback, useEffect } from 'react';
import { SectionContextMenu, SubsectionBlock, makeSubsectionHandlers, TableCellContextMenu, useTableCellColors } from '../components/SOPSection';

const purple = '#7030a0';

const s = {
  card:   { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h1:     { fontSize: 15, fontWeight: 700, color: purple, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 12px' },
  body:   { outline: 'none', minHeight: 48, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 },
};

function EditableBody({ sectionId, initialContent, onContentChange }) {
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
  return <div ref={ref} contentEditable suppressContentEditableWarning style={s.body} />;
}

const SECTION_HTML = {
  standard_units: '<p>Single base substitutions (SBS) are mutations consisting of a single base change, i.e. a C to T transition in a TCA trinucleotide context. Also known as SNVs or sometimes (in the case of germline variants) SNPs.</p><p>Indels (IDs) are mutations consisting of insertions or deletions of DNA, under 50bp in size.</p><p>Structural variations (SVs) involve large (larger than IDs) duplications, insertions or deletions, as well as structural rearrangements (ie. inversions, translocations)</p><p>Copy number variants (CNVs) are a subset of SVs which involve large (larger than IDs) duplications or deletions of DNA.</p><p>Discretized mutation burdens (SBS, ID, SVs) are counted in terms of the number of variants present in a sample. Consequently the standard unit for these mutations is simply a <strong>count.</strong> In the case of <strong>single-molecule DNA sequencing</strong>, where the basepairs of molecules of DNA sequenced proportionally affects the number of variants detected, mutational burden should be described as <strong>mutations per (mega)base</strong>, or equivalently and clearly labeled units (e.g. the use of mutations per diploid cell in numerous NanoSeq publications, including <em>Abascal 2021</em>).</p>',
  mutational_burdens: '<p>For single base substitutions (SBS), Indel (ID), and Structural Variants (SV), which are discrete events, this is simple. In the case of whole-genome or whole-exome sequencing, where mutational burden is invariant to sequencing depth, this should be quantified as the <strong>total number of events per sample</strong>, with one barplot showing mutational burden (y-axis) per sample (x-axis), and a box plot of mutational burden (y-axis) for each grouping of the experiment\'s dependent variable (x-axis).</p><p>In the case of copy number variants (CNVs), simply defining mutational burden is not a solved problem in this space. Numerous methods exist to summarize copy number chromosomal instability (CIN), including the fraction genome altered (measuring fraction non-diploid genome), CNV segment count, and CNV segment sizes. One of these measurements should be used in figures to communicate CNV burden analogously to SBS/ID/SV burdens described above.</p>',
  mutational_spectra: '<p>For whichever signature paradigm is selected (SBS - 96 channel, ID - 83 or 89 channel, SV, CNV, etc), a figure is required to show the total mutational spectra in each relevant biological sample. Care should be taken to ensure that the samples are presented in logical order, with rows of plots corresponding to samples and columns corresponding to dependent variables.</p>',
  de_novo_selection: '<p>After running de novo signature extraction, a figure is required to demonstrate the selection of signature counts. This is typically produced as standard from SigProfilerExtractor, and indicates the number of signatures extracted along the x-axis, and signature metrics on the y-axis such as mean sample stability and sample cosine distance. This figure should be accompanied by a brief explanation of which signature solution was selected and why</p>',
  signature_decomposition: '<p>After de novo extraction, a series of figures are required to show the decomposition of de novo signatures into reference mutational signatures. Each de novo signature and its decompositions must be shown as in the output from SigProfilerAssignment, and these figures should be accompanied by a brief description of the etiologies of all extracted signatures as well as which, if any, de novo signatures were retained as de novo (ie. not decomposed into reference signatures)</p>',
  signature_breakdown: '<p>Analogously to point #1 above, a barplot breakdown of mutational burdens in each sample, split by mutational signature is required. This should be plotted as stacked bar plots, with colors indicating mutational signatures. Signatures should be colored and grouped similarly by etiology (ie. APOBEC signatures should all be a shade of purple, aging signatures a shade of yellow, etc) according to the analyst\'s discretion and knowledge of those mutational processes. As before, single-molecule sequencing mutational signature burdens should be corrected for sequencing coverage (ie. duplex recovery or equivalent) in these visualizations.</p>',
  signature_comparisons: '<p>As in point #1, a comparison of dependent variables is required for each mutational signature in the form of boxplots. X-axis should communicate the dependent variable being compared, and the y-axis should communicate mutational burden.</p>',
};

const INITIAL_SECTIONS = [
  { id: 'standard_units',          label: '0. Standard units and terminology',  builtin: true, content: SECTION_HTML.standard_units },
  { id: 'mutational_burdens',      label: '1. Overview of mutational burdens',  builtin: true, content: SECTION_HTML.mutational_burdens },
  { id: 'mutational_spectra',      label: '2. Overview of mutational spectra',  builtin: true, content: SECTION_HTML.mutational_spectra },
  { id: 'de_novo_selection',       label: '3. De novo signature selection',      builtin: true, content: SECTION_HTML.de_novo_selection },
  { id: 'signature_decomposition', label: '4. Signature decomposition',          builtin: true, content: SECTION_HTML.signature_decomposition },
  { id: 'signature_breakdown',     label: '5. Signature breakdown per sample',   builtin: true, content: SECTION_HTML.signature_breakdown },
  { id: 'signature_comparisons',   label: '6. Signature comparisons per sample', builtin: true, content: SECTION_HTML.signature_comparisons },
];

export default function MutationalSignaturesSOP({ canEdit }) {
  const [docTitle, setDocTitle] = useState(() => {
    try { return localStorage.getItem('mutsig_title') || 'Mutational Signatures - Standard Analysis Outline'; } catch { return 'Mutational Signatures - Standard Analysis Outline'; }
  });
  const [sections, setSections] = useState(() => {
    try {
      const saved = localStorage.getItem('mutsig_sections');
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) return p; }
    } catch {}
    return INITIAL_SECTIONS;
  });
  const [ctxMenu, setCtxMenu] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('mutsig_sections', JSON.stringify(sections)); } catch {}
  }, [sections]);

  useEffect(() => {
    try { localStorage.setItem('mutsig_title', docTitle); } catch {}
  }, [docTitle]);

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
  const { cellMenu, closeCellMenu, pickCellColor } = useTableCellColors(containerRef, canEdit, 'cell_colors_mutsig');

  return (
    <div ref={containerRef} onMouseDown={() => setCtxMenu(null)}>
      {/* Document title */}
      <div style={{ marginBottom: 28 }}>
        {canEdit
          ? <input
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', background: 'none', border: 'none', borderBottom: '2px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', padding: '4px 0' }}
            />
          : <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{docTitle}</h2>
        }
      </div>

      {sections.map((sec, idx) => (
        <div key={sec.id} style={{ ...s.card, background: sec.bgColor || 'var(--bg-card)' }}
          onContextMenu={canEdit ? e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, idx }); } : undefined}>
          {canEdit
            ? <input
                value={sec.label}
                onChange={e => updateLabel(sec.id, e.target.value)}
                placeholder={`Section ${idx + 1}`}
                style={{ ...s.h1, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', display: 'block' }}
              />
            : <div style={s.h1}>{sec.label || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Section {idx + 1}</span>}</div>
          }
          <EditableBody
            sectionId={sec.id}
            initialContent={sec.content}
            onContentChange={content => updateContent(sec.id, content)}
          />
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
