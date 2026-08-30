import { useState, useRef, useCallback, useEffect } from 'react';
import { SectionContextMenu, SubsectionBlock, makeSubsectionHandlers, TableCellContextMenu, useTableCellColors, TabInputModal, TabConfirmModal, PillTabs, TabContextMenu } from '../components/SOPSection';

const s = {
  section: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: 'var(--purple-primary)', textDecoration: 'underline', margin: '0 0 14px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
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
    case 'lm_timing': return (
      <p style={s.p}><strong>Please plan to go through your slides in ~50 minutes to allow for discussion. An alarm will go off 5 minutes before the end of the meeting,</strong> and meetings will strictly end after 1:30 hrs. We recommend that you practice your presentation beforehand until you become comfortable with the amount of content needed to complete the presentation in ~50 minutes. Lab meetings are given <strong>standing up</strong> to mimic the setting in conferences.</p>
    );
    case 'lm_format': return (
      <>
        <p style={s.p}>A successful 50-min presentation (assuming no interruptions) should be formatted as follows:</p>
        <p style={s.p}><u>Introduction (5–15 mins):</u> <strong>Provide relevant background by answering the following 4 questions:</strong></p>
        <ul style={s.ul}>
          <li style={s.li}>Why is what you are studying important?</li>
          <li style={s.li}>What is the existing data out there (or in the lab) relevant to your project?</li>
          <li style={s.li}>What are the gaps, i.e. what questions remain unaddressed?</li>
          <li style={s.li}>What are the specific questions you are addressing to close the gaps?</li>
        </ul>
        <p style={s.p}><u>Data (25–40 mins):</u> Show your progress on the project and get input on both general directions and specifics such as experimental designs. <strong>Organize the data into the questions you raised in the introduction, and ensure it is always clear which questions you are addressing when presenting experiments. This section also serves for you to get input over experiments and experimental designs that you are thinking about — please draw those out outlining as much detail as you can (model, assay, controls, conditions) so that we can effectively discuss.</strong></p>
        <p style={s.p}><u>Conclusions and next steps (~5 mins):</u> Summarize your conclusions and <strong>prioritize next steps while giving a rationale.</strong></p>
      </>
    );
    case 'lm_clarity': return (
      <>
        <p style={{ ...s.p, background: '#EAFAF1', border: '1px solid #A9DFBF', borderRadius: 6, padding: '10px 14px' }}>
          <strong>Successful presentations are those where everyone understands the relevance of your work and is able to follow your data. Because the presenter knows their research better than anyone and because no one else will have equivalent level of familiarity, it is the presenter's responsibility to make sure that everyone can follow the relevance and details. We achieve this by:</strong>
        </p>
        <p style={s.p}><u>Content:</u> The rule of thumb to make sure that everyone follows is less is more. Therefore, the figures or graphics that you will not be directly addressing are discouraged as they distract the audience.</p>
        <p style={s.p}><u>Figure descriptions:</u> The goal is for everyone to understand every figure that you are addressing. As a rule of thumb, expect no one to understand the data format or type you are showing — down to simple things like Western blots. The first key to success is that you understand the data yourself. This is particularly important when presenting data from published work. The second is communicating what the figure shows effectively. To achieve clarity over figure descriptions, we ask that you describe all of the below:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Model</strong> (e.g. lung cancer cell lines, prostate cancers following x treatment)</li>
          <li style={s.li}><strong>Assay</strong> (e.g. western blot, whole-genome sequencing, mRNA, FACS)</li>
          <li style={s.li}><strong>Data</strong> (e.g. for tables: each row is x, each column is y; for plots: x and y axes; for dotplots: what the dots are)</li>
        </ul>
        <p style={s.p}><u>Labelling:</u> Slides are expected to be clearly labelled. Clear labelling includes:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Informative slide titles</strong> — use a single statement summarizing the message of the slide. Titles are most informative when they serve as a conclusion (e.g. "Upregulation of BRCA1 Gene in Triple-Negative Breast Cancer Patients" rather than "Gene Expression Analysis").</li>
          <li style={s.li}><strong>Titles on all plots</strong> (recommended: assay and model, e.g. "APOBEC3A expression in prostate cancer cell lines")</li>
          <li style={s.li}><strong>Clearly labelled axes</strong> (and understanding of them) on all plots</li>
          <li style={s.li}><strong>Labelling legends and other features</strong> relevant for the group to understand the presented data</li>
        </ul>
        <p style={s.p}><u>Abbreviations:</u> <strong>The use of abbreviations is mostly discouraged</strong>, and where those are used they should be defined upfront. If non-standard, abbreviations should be written out in full at every instance in text on the slides as a reminder.</p>
      </>
    );
    case 'jc_timing': return (
      <p style={s.p}>Journal clubs are <strong>1 hr long</strong> and involve a lot of discussion. Please aim to go through your slides in <strong>~35–40 minutes</strong> (assuming no interruptions) to enable discussion. An alarm will go off 5 minutes before the end of the meeting.</p>
    );
    case 'jc_format': return (
      <>
        <p style={s.p}>For a successful 35–40 min presentation:</p>
        <p style={s.p}><u>Introduction (~5 mins):</u> The background to the paper and what questions it was set out to address (as per the title and introduction of the paper).</p>
        <p style={s.p}><u>Data (~25–30 mins):</u> The goal is to do a deep dive into the data and <strong>critically</strong> assess the quality of the data and conclusions, with a focus on those data pieces relevant to the lab's and/or your own research. This will most often require you to go, understand, and present parts of the supplementary data.</p>
        <p style={s.p}><u>Conclusions (~5 mins):</u> <strong>The purpose is to contrast the conclusions of the paper with your own conclusions.</strong> I.e. are you convinced that the paper really shows what it states to be showing? If not, what are the remaining questions (e.g. suboptimal readout/experimental design; conclusions you disagree with)?</p>
      </>
    );
    case 'jc_clarity': return (
      <>
        <p style={s.p}>While slides do not need to be as polished as for lab meetings (everyone is expected to have read the paper), the group still need to be able to follow. Clearly describe (by labelling or verbally) what you are showing.</p>
        <p style={s.p}><strong><u>Further, you are not expected to talk about all the data in the paper — focus on those pieces relevant to yours or the lab's research are encouraged (less is more!)</u></strong></p>
      </>
    );
    default: return null;
  }
}

const LAB_MEETING_INIT = [
  { id: 'lm_timing',  label: '1. TIMING',  builtin: true },
  { id: 'lm_format',  label: '2. FORMAT',  builtin: true },
  { id: 'lm_clarity', label: '3. CLARITY', builtin: true },
];

const JOURNAL_CLUB_INIT = [
  { id: 'jc_timing',  label: '1. TIMING',  builtin: true },
  { id: 'jc_format',  label: '2. FORMAT',  builtin: true },
  { id: 'jc_clarity', label: '3. CLARITY', builtin: true },
];

function useSections(storageKey, initial) {
  const [sections, setSections] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) return p; }
    } catch {}
    return initial;
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(sections)); } catch {}
  }, [sections, storageKey]);

  const addSection = useCallback((afterIdx) => {
    const id = `custom_${Date.now()}`;
    setSections(prev => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, { id, label: '', builtin: false, content: '', subsections: [] });
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

  const handlers = makeSubsectionHandlers(setSections);

  return { sections, addSection, deleteSection, moveSection, updateLabel, updateContent, setSections, ...handlers };
}

function SectionList({ sections, canEdit, addSection, deleteSection, moveSection, updateLabel, updateContent, addSubsection, deleteSubsection, updateSubsectionContent, updateSubsectionBgColor, updateSectionBgColor }) {
  const [ctxMenu, setCtxMenu] = useState(null);
  const inputRefs = useRef({});
  const containerRef = useRef(null);
  const { cellMenu, closeCellMenu, pickCellColor } = useTableCellColors(containerRef, canEdit, 'cell_colors_meetings');

  return (
    <div ref={containerRef} onMouseDown={() => setCtxMenu(null)}>
      {sections.map((sec, idx) => (
        <div key={sec.id} style={{ ...s.section, background: sec.bgColor || 'var(--bg-card)' }}
          onContextMenu={canEdit ? e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, idx }); } : undefined}>
          {sec.builtin ? (
            <>
              {canEdit
                ? <input ref={el => { inputRefs.current[sec.id] = el; }} value={sec.label} onChange={e => updateLabel(sec.id, e.target.value)}
                    style={{ ...s.h2, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', display: 'block' }} />
                : <div style={s.h2}>{sec.label}</div>
              }
              <BuiltinBody id={sec.id} />
            </>
          ) : (
            <>
              {canEdit
                ? <input ref={el => { inputRefs.current[sec.id] = el; }} value={sec.label} onChange={e => updateLabel(sec.id, e.target.value)} placeholder={`Section ${idx + 1}`}
                    style={{ ...s.h2, background: 'none', border: 'none', borderBottom: '1px solid var(--purple-primary)', outline: 'none', width: '100%', cursor: 'text', boxSizing: 'border-box', display: 'block' }} />
                : <div style={s.h2}>{sec.label || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Section {idx + 1}</span>}</div>
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
          onAddSubsection={() => addSubsection(sections[ctxMenu.idx]?.id)}
          onChangeBgColor={color => updateSectionBgColor(sections[ctxMenu.idx]?.id, color)}
          onMoveUp={ctxMenu.idx > 0 ? () => moveSection(ctxMenu.idx, -1) : null}
          onMoveDown={ctxMenu.idx < sections.length - 1 ? () => moveSection(ctxMenu.idx, 1) : null}
          onDelete={!sections[ctxMenu.idx]?.builtin ? () => deleteSection(ctxMenu.idx) : null}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

const DEFAULT_MEETING_SUBS = [
  { id: 'lab_meeting',  label: 'Lab Meeting Guidelines',  builtin: true },
  { id: 'journal_club', label: 'Journal Club Guidelines', builtin: true },
];
const MEETING_SUBS_KEY = 'meeting_tabs_v1';
const MEETING_BUILTIN_IDS = new Set(['lab_meeting', 'journal_club']);

function MeetingCustomTabContent({ tabId }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const storageKey = `meeting_custom_tab_${tabId}`;
  const [init] = useState(() => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } });
  useEffect(() => { if (ref.current) ref.current.innerHTML = init; }, []); // eslint-disable-line
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new MutationObserver(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { try { localStorage.setItem(storageKey, el.innerHTML); } catch {} }, 600);
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { obs.disconnect(); clearTimeout(timer.current); };
  }, [storageKey]); // eslint-disable-line
  return (
    <div contentEditable={false}>
      <div ref={ref} contentEditable suppressContentEditableWarning
        style={{ outline: 'none', minHeight: 200, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }} />
    </div>
  );
}

export default function MeetingStandards({ canEdit }) {
  const [subs, setSubs] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(MEETING_SUBS_KEY)); return Array.isArray(s) && s.length ? s : DEFAULT_MEETING_SUBS; }
    catch { return DEFAULT_MEETING_SUBS; }
  });
  const [sub, setSub] = useState('lab_meeting');
  const [tabCtx, setTabCtx] = useState(null);
  const [modal, setModal] = useState(null);
  const lm = useSections('meeting_lm_sections', LAB_MEETING_INIT);
  const jc = useSections('meeting_jc_sections', JOURNAL_CLUB_INIT);
  const active = sub === 'lab_meeting' ? lm : jc;

  function saveSubs(next) { setSubs(next); try { localStorage.setItem(MEETING_SUBS_KEY, JSON.stringify(next)); } catch {} }

  function addTab(nearId, side) {
    setTabCtx(null);
    setModal({ type: 'input', title: 'New tab name:', defaultValue: '', onConfirm: name => {
      const newTab = { id: `custom_${Date.now()}`, label: name, builtin: false };
      const idx = subs.findIndex(s => s.id === nearId);
      const next = [...subs];
      next.splice(side === 'left' ? idx : idx + 1, 0, newTab);
      saveSubs(next);
      setSub(newTab.id);
    }});
  }

  function renameTab(id) {
    const current = subs.find(s => s.id === id)?.label || '';
    setTabCtx(null);
    setModal({ type: 'input', title: 'Rename tab:', defaultValue: current, onConfirm: name => {
      if (name !== current) saveSubs(subs.map(s => s.id === id ? { ...s, label: name } : s));
    }});
  }

  function deleteTab(id) {
    setTabCtx(null);
    setModal({ type: 'confirm', message: 'Delete this tab?', onConfirm: () => {
      const next = subs.filter(s => s.id !== id);
      saveSubs(next);
      if (sub === id) setSub(next[0]?.id || '');
    }});
  }

  return (
    <div onMouseDown={() => setTabCtx(null)}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 24px' }}>Guidelines for lab meetings and journal clubs</p>

      <div contentEditable={false} style={{ marginBottom: 28 }}>
        <PillTabs
          tabs={subs} active={sub} onSelect={setSub}
          onContextMenu={canEdit ? (e, tabId) => setTabCtx({ x: e.clientX, y: e.clientY, id: tabId }) : undefined}
        />
      </div>

      {sub === 'lab_meeting' && (
        <p style={s.p}>Our lab meetings are essential to the success of our team. They provide an opportunity for you to develop your presentation skills, which is crucial for any career you wish to pursue in science or beyond. Additionally, lab meetings are a critical opportunity for the team to learn about your project, brainstorm together, and provide the best input. <strong>To ensure the success of our lab meetings, we have the following guidelines:</strong></p>
      )}
      {sub === 'journal_club' && (
        <p style={s.p}>The purpose of journal clubs is to stay in the loop with the field. Papers are agreed upon depending on their relevance to ongoing research in the lab. <strong>The expectation is that everyone reads the paper beforehand to be able to effectively participate in the discussion.</strong> Presentations can be done sitting or standing, to the presenter's preference.</p>
      )}

      {MEETING_BUILTIN_IDS.has(sub) && (
        <SectionList
          key={sub}
          sections={active.sections}
          canEdit={canEdit}
          addSection={active.addSection}
          deleteSection={active.deleteSection}
          moveSection={active.moveSection}
          updateLabel={active.updateLabel}
          updateContent={active.updateContent}
          addSubsection={active.addSubsection}
          deleteSubsection={active.deleteSubsection}
          updateSubsectionContent={active.updateSubsectionContent}
          updateSubsectionBgColor={active.updateSubsectionBgColor}
          updateSectionBgColor={active.updateSectionBgColor}
        />
      )}
      {!MEETING_BUILTIN_IDS.has(sub) && subs.find(s => s.id === sub) && (
        <MeetingCustomTabContent key={sub} tabId={sub} />
      )}

      {tabCtx && (
        <TabContextMenu
          x={tabCtx.x} y={tabCtx.y}
          onAddLeft={() => addTab(tabCtx.id, 'left')}
          onAddRight={() => addTab(tabCtx.id, 'right')}
          onRename={() => renameTab(tabCtx.id)}
          onDelete={!MEETING_BUILTIN_IDS.has(tabCtx.id) ? () => deleteTab(tabCtx.id) : null}
          onClose={() => setTabCtx(null)}
        />
      )}
      {modal?.type === 'input' && <TabInputModal title={modal.title} defaultValue={modal.defaultValue} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
      {modal?.type === 'confirm' && <TabConfirmModal message={modal.message} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
    </div>
  );
}
