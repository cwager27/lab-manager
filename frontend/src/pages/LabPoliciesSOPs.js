import { useState } from 'react';
import { useResizableColumns, ColResizer } from '../lib/useResizableColumns';
import { FileText, Clock } from 'lucide-react';
import LabPolicies from './LabPolicies';
import MeetingStandards from './MeetingStandards';
import BenchlingPolicy from './BenchlingPolicy';
import TissueCultureSOP from './TissueCultureSOP';
import OrderingSOP from './OrderingSOP';

const TABS = [
  { id: 'policies',        label: 'Lab Policies' },
  { id: 'meetings',        label: 'Lab Meetings Standards' },
  { id: 'benchling',       label: 'Benchling Use & Entries Policy' },
  { id: 'tissue_culture',  label: 'Tissue Culture SOP' },
  { id: 'ordering',        label: 'Ordering SOP' },
  { id: 'reagent',         label: 'Reagent Categorization & Storage SOP', hasSubs: true },
  { id: 'sample_naming',   label: 'Sample Naming SOPs' },
  { id: 'sequencing_qc',   label: 'Sequencing QC SOPs' },
  { id: 'mutational_data', label: 'Mutational Data Presentation SOP' },
  { id: 'cell_line',       label: 'Cell Line Storage & Use SOP', comingSoon: true },
];

// ── Reagent Categorization SOP ────────────────────────────────────────────────
const QUARTZY_CATEGORIES = [
  { name: 'Proteins and enzymes',         def: '',                                                                                                                                                                                                                                                                                                                                                                                                                  examples: 'Individual purified biological macromolecules, including proteins and enzymes, that are themselves the material being used (e.g. catalytic, binding, or structural activity), not small-molecule inhibitors, buffers, or chemical modifiers. This category includes recombinant, purified, or native proteins supplied as discrete entities.' },
  { name: 'Antibodies',                   def: 'Antibodies',                                                                                                                                                                                                                                                                                                                                                                                                       examples: '' },
  { name: 'Cell Line',                    def: 'Human or mouse cell lines purchased via repositories',                                                                                                                                                                                                                                                                                                                                                              examples: '' },
  { name: 'Biological materials/specimens', def: 'All purchased non-cell line biological specimens',                                                                                                                                                                                                                                                                                                                                                               examples: 'eg bacterial / yeast cultures, cord blood DNA, tissues, samples, RNA, non-live cell pellets, protein extracts (but not specific, purified or recombinant proteins)' },
  { name: 'Tissue Culture Reagents',      def: 'Chemical or liquid reagents added to cell culture media or used for maintenance/passaging; things that are tissue culture specific i.e. used in tissue culture room',                                                                                                                                                                                                                                               examples: 'DMEM, RPMI, IMDM, FBS, trypsin, PBS, GlutaMAX, Matrigel, antibiotics.' },
  { name: 'Disposable Supplies',          def: 'Physical consumables or plasticware that are used and discarded; not chemicals or reagents.',                                                                                                                                                                                                                                                                                                                       examples: 'Flasks, plates, tubes, tips, filters, gloves, wipes, serological pipettes, Parafilm, racks.' },
  { name: 'Sequence-Based Reagents',      def: 'Reagents defined by sequence, nomenclature requires specification per examples (not other categories and specificity eg not 3A/A3B-1 but 3A/3B substrate OLIGO, PANELS for nanoseq',                                                                                                                                                                                                                               examples: 'Primers (FWD/REV), oligos, plasmids, cloning vectors, gBlocks.' },
  { name: 'General Lab Chemicals',        def: 'Reagents used broadly across many different laboratory processes, including chemistry, molecular biology, protein work, and general lab operations. Not restricted to a single workflow class.',                                                                                                                                                                                                                     examples: '' },
  { name: 'Specialized Reagents,  Kits, Supplies', def: 'Reagents, buffers, enzymatic modules, or kits that are used exclusively for a specific biological process or analytical workflow, and are not repurposed outside that context. Includes DNA/RNA extraction kits, library-prep reagents, assay-specific buffers, stains, controls, and detection systems. Also kit/assay-specific supplies eg Qbit tubes. Also includes drugs, Specific Signaling Inhibitors / Modulators and Cellular State Modifiers & Biochemical Assay Reagents, small molecule inhibitors', examples: '' },
];

const OTHER_CATEGORIES = ['Shipping', 'Cores', 'Subcapital', 'Capital', 'Travel & Conferences', 'Meals & Fun', 'CR/CO', 'Subscriptions'];

const REMOVED_CATEGORIES = ['Office supplies- becomes disposable supplies', 'CR and CO - becoming CR/CO', 'Computer hardware -becomes subcaptal'];


const thCell    = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#ffffff', borderBottom: '1px solid #5a1e82', position: 'relative' };
const tdName    = { padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', verticalAlign: 'top', borderBottom: '1px solid var(--border)', height: 86, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' };
const tdBody    = { padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, verticalAlign: 'top', borderBottom: '1px solid var(--border)', height: 86, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' };
const tdCompact = { padding: '5px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' };
const tdCompactEmpty = { padding: '5px 16px', borderBottom: '1px solid var(--border)' };
const sectionRow  = { background: 'var(--bg-secondary)' };
const sectionCell = { padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' };

function ReagentCategorizationSOP() {
  const { widths: reagentCatWidths, onColMouseDown: reagentCatResize } = useResizableColumns(3);
  return (
    <div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 28 }}>
        <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{reagentCatWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead>
            <tr style={{ background: '#7030a0' }}>
              <th style={thCell}>Category<ColResizer colIdx={0} totalCols={3} onColMouseDown={reagentCatResize} /></th>
              <th style={thCell}>Definition / Scope<ColResizer colIdx={1} totalCols={3} onColMouseDown={reagentCatResize} /></th>
              <th style={thCell}>Examples<ColResizer colIdx={2} totalCols={3} onColMouseDown={reagentCatResize} /></th>
            </tr>
          </thead>
          <tbody>
            {/* QUARTZY CATEGORIES section */}
            <tr style={sectionRow}>
              <td colSpan={3} style={sectionCell}>Quartzy Categories</td>
            </tr>
            {QUARTZY_CATEGORIES.map((cat, i) => (
              <tr key={cat.name} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                <td style={tdName}>{cat.name}</td>
                <td style={tdBody}>{cat.def}</td>
                <td style={tdBody}>{cat.examples}</td>
              </tr>
            ))}

            {/* OTHER CATEGORIES section */}
            <tr style={sectionRow}>
              <td colSpan={3} style={sectionCell}>Other Categories Not Recorded in Quartzy</td>
            </tr>
            {OTHER_CATEGORIES.map((name, i) => (
              <tr key={name} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                <td style={tdCompact}>{name}</td>
                <td style={tdCompactEmpty}></td>
                <td style={tdCompactEmpty}></td>
              </tr>
            ))}

            {/* REMOVED CATEGORIES section */}
            <tr style={sectionRow}>
              <td colSpan={3} style={sectionCell}>Removed Categories</td>
            </tr>
            {REMOVED_CATEGORIES.map((name, i) => (
              <tr key={name} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                <td style={tdCompact}>{name}</td>
                <td style={tdCompactEmpty}></td>
                <td style={tdCompactEmpty}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Specialized Reagents Storage Box Clarification</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* BOX 1 */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📦 BOX 1 — Chemotherapies</p>
        </div>

        {/* BOX 2 */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>📦 BOX 2 — Targeted Signaling Inhibitors / Modulators</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 4px' }}><strong>Includes :</strong> Targeted inhibitors/modulators of a defined signaling node ie Acts on a specific, named target or pathwa; ie If it cleanly inhibits or modulates a specific signaling component → Box 2</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 4px' }}><strong>Includes</strong> clinical drugs and research inhibitors</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 4px' }}><strong>Excludes:</strong> Excludes broad stressors, metabolic poisons, mimetics, or buffering agents, chemotherapy agents (those go into chemotherapies box)</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>You can answer: "This inhibits X" (e.g., ER, BTK, JAK, EZH2, HIF-2α)</p>
        </div>

        {/* BOX 3 */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>📦 BOX 3 — Cellular State Modifiers &amp; Biochemical Assay Reagents</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 8px' }}>Reagents that alter, buffer, or report global cellular states, or that are generic biochemical reagents used across assays, without targeting a specific signaling node.</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 4px' }}>These reagents:</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 2px' }}>Act broadly or pleiotropically</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 2px' }}>Are not chemotherapies</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 2px' }}>Are not pathway-specific inhibitors</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>Are not DNA/RNA-based reagents</p>
        </div>
      </div>
    </div>
  );
}

// ── Reagent Category Locations ────────────────────────────────────────────────
const REAGENT_LOCATIONS = [
  { type: 'Proteins and Enzymes', locations: ['Protein Box -20°C (#2-Lab)', 'Restriction Enzymes Box -20°C (#2-Lab)', 'Other Enzymes Box -20°C (#2-Lab)'] },
  { type: 'Antibodies', locations: ['Antibodies Box 4°C (#1-Lab)', 'Primary Antibodies Box -20°C (#2-Lab)', 'Secondary Antibodies Box -20°C (#2-Lab)'] },
  { type: 'Biological Materials / Specimens', locations: ['4°C (#1-Deli)', '-20°C (#1-Specimens-Lab)', '-80°C (#1)', 'Receiving 4°C (Deli Fridge)', 'Receiving -20°C (#2-Lab)', 'Receiving -80°C (#1-Lab)'] },
  { type: 'Cell Lines', locations: ['Cryofreezer', 'New Cell Lines Box -80°C (#1)'] },
  { type: 'Tissue Culture Reagents', locations: ['-20°C (#2-Lab)', '-20°C (#4-TC)', '4°C (#4-TC)', 'Cold Room'] },
  { type: 'Disposable Supplies', locations: ['Receiving RT (Lab)', 'RT Lab (Active TC-Closet)', 'RT Lab (Active TC-Rack)', 'RT Lab (Designated Locations)', 'RT Storage - Hallway Cabinets', 'RT Storage - Hallway Closet 8-001'] },
  { type: 'Sequence-Based Reagents', locations: ['Receiving -80°C (#1-Lab)', 'Receiving -20°C (#2-Lab)', 'Plasmid/Vector Stock Box -20°C (#2-Lab) — permission-only', 'Plasmid/Vector Stock Box -80°C (#1) — permission-only', '-20°C (#2-Lab)', '-20°C (#3-DuplexSeq-Lab)'] },
  { type: 'General Lab Chemicals', locations: ['Receiving RT (Lab)', 'Receiving 4°C (Deli Fridge)', 'Receiving -20°C (#2-Lab)', 'Receiving -80°C (#1-Lab)', '4°C (#4-TC)', '4°C (#1-Deli)', '-20°C (#2-Lab)', '-20°C (#4-TC)', '-80°C (#1)', 'RT Lab (Designated Locations)', 'RT Flammable Cabinet', 'RT Under Fume Hood'] },
  { type: 'Specialized Reagents, Kits, Supplies', locations: ['-20°C (#2-Lab)', '-20°C (#3-DuplexSeq-Lab)', '-20°C (#4-TC)', '-80°C (#1)', '4°C (#1-Deli)', '4°C (#4-TC)', 'Cell State Modulators & Biochem. Reagents Box -20°C (#2-Lab)', 'Cell State Modulators & Biochem. Reagents Box -80°C (#1)', 'Cell State Modulators & Biochem. Reagents Box 4°C (#1-Lab)', 'Chemotherapies Box -20°C (#2-Lab)', 'Chemotherapies Box -80°C (#1)', 'Chemotherapies Box 4°C (#1-Lab)', 'qPCR/PCR Stock Box -20°C (#2-Lab) — permission-only', 'Receiving -20°C (#2-Lab)', 'Receiving -80°C (#1-Lab)', 'Receiving 4°C (Deli Fridge)', 'Receiving RT (Lab)', 'RT (Designated) + 4°C (#3-Lab)', 'RT Flammable Cabinet', 'RT Lab (Designated Locations)', 'RT Storage - DNA/RNA Isolation Cabinet (permission-only)', 'RT Under Fume Hood', 'Targeted Signaling Inhibitors & Modulators Box -20°C (#2-Lab)', 'Targeted Signaling Inhibitors & Modulators Box -80°C (#1)', 'Targeted Signaling Inhibitors & Modulators Box 4°C (#1-Lab)'] },
];

function ReagentCategoryLocations() {
  const { widths: reagentLocWidths, onColMouseDown: reagentLocResize } = useResizableColumns(2);
  return (
    <div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table className="resizable-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{reagentLocWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead>
            <tr style={{ background: '#7030a0' }}>
              <th style={thCell}>Inventory Type<ColResizer colIdx={0} totalCols={2} onColMouseDown={reagentLocResize} /></th>
              <th style={thCell}>Locations<ColResizer colIdx={1} totalCols={2} onColMouseDown={reagentLocResize} /></th>
            </tr>
          </thead>
          <tbody>
            {REAGENT_LOCATIONS.map((row, i) => (
              <tr key={row.type} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', verticalAlign: 'top', borderBottom: '1px solid var(--border)', height: 86, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>{row.type}</td>
                <td style={{ padding: '10px 16px', verticalAlign: 'top', borderBottom: '1px solid var(--border)', height: 86, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {row.locations.map(loc => (
                      <li key={loc} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 2 }}>{loc}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const REAGENT_SUBS = [
  { id: 'categorization', label: 'Reagent Categorization SOP' },
  { id: 'locations',      label: 'Reagent Category Locations' },
];

function ReagentTab() {
  const [sub, setSub] = useState('categorization');
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 28 }}>
        {REAGENT_SUBS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{
            padding: '8px 20px', border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: sub === t.id ? 700 : 400,
            color: sub === t.id ? 'var(--purple-primary)' : 'var(--text-secondary)',
            borderBottom: sub === t.id ? '2px solid var(--purple-primary)' : '2px solid transparent',
            marginBottom: -2, cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'categorization' ? <ReagentCategorizationSOP /> : <ReagentCategoryLocations />}
    </div>
  );
}

// ── Sample Naming SOPs ────────────────────────────────────────────────────────
const SAMPLE_NAMING_SUBS = [
  { id: 'guidelines', label: 'Sample Naming Guidelines' },
  { id: 'cell_line',  label: 'Cell Line Naming Examples' },
];

function SampleNamingSOPs() {
  const [sub, setSub] = useState('guidelines');
  const src = sub === 'guidelines'
    ? 'https://docs.google.com/document/d/1y8EYDUC-imv0h41PQU4egtgmcmjtOJLX/preview'
    : 'https://docs.google.com/spreadsheets/d/1KNmP7BkC8_yju727lssgNxkXkEnHZ4kjWZD7gm1IS88/preview';
  const openUrl = sub === 'guidelines'
    ? 'https://docs.google.com/document/d/1y8EYDUC-imv0h41PQU4egtgmcmjtOJLX/edit'
    : 'https://docs.google.com/spreadsheets/d/1KNmP7BkC8_yju727lssgNxkXkEnHZ4kjWZD7gm1IS88/edit?gid=0#gid=0';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)' }}>
          {SAMPLE_NAMING_SUBS.map(t => (
            <button key={t.id} onClick={() => setSub(t.id)} style={{
              padding: '8px 20px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: sub === t.id ? 700 : 400,
              color: sub === t.id ? 'var(--purple-primary)' : 'var(--text-secondary)',
              borderBottom: sub === t.id ? '2px solid var(--purple-primary)' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
        <a href={openUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--purple-primary)', fontWeight: 600, textDecoration: 'none', background: 'var(--purple-faint)', padding: '5px 12px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          Open in Google ↗
        </a>
      </div>
      <iframe
        key={sub}
        src={src}
        title={sub === 'guidelines' ? 'Sample Naming Guidelines' : 'Cell Line Naming Examples'}
        style={{ width: '100%', height: 720, border: '1px solid var(--border)', borderRadius: 8 }}
        allowFullScreen
      />
    </div>
  );
}

// ── Mutational Data Presentation SOP ─────────────────────────────────────────
function MutationalDataSOP() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Mutational Data Presentation SOP</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Standards for presenting mutation data in figures and reports</p>
        </div>
        <a href="https://docs.google.com/document/d/1_7toTQ_Obm37o-LSfRZoVP5JZE8DOvn-Os529bw-zg4/edit?tab=t.0#heading=h.dsjfo2kvjh6p" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--purple-primary)', fontWeight: 600, textDecoration: 'none', background: 'var(--purple-faint)', padding: '5px 12px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          Open in Google Docs ↗
        </a>
      </div>
      <iframe
        src="https://docs.google.com/document/d/1_7toTQ_Obm37o-LSfRZoVP5JZE8DOvn-Os529bw-zg4/preview"
        title="Mutational Data Presentation SOP"
        style={{ width: '100%', height: 720, border: '1px solid var(--border)', borderRadius: 8 }}
        allowFullScreen
      />
    </div>
  );
}

// ── Placeholder for tabs with no content yet ──────────────────────────────────
function PlaceholderContent({ tab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--purple-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        {tab.comingSoon
          ? <Clock size={26} color="var(--purple-primary)" />
          : <FileText size={26} color="var(--purple-primary)" />}
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>{tab.label}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', maxWidth: 400 }}>{tab.desc || 'Content for this section is being prepared.'}</p>
      {tab.comingSoon ? (
        <span style={{ fontSize: 12, fontWeight: 600, background: '#FEF9E7', color: '#F39C12', border: '1px solid #FAD7A0', borderRadius: 20, padding: '4px 14px' }}>
          Introduced — content in progress
        </span>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px' }}>
          Content coming soon
        </span>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LabPoliciesSOPs({ userRole }) {
  const [tab, setTab] = useState(() => localStorage.getItem('sops_tab') || 'policies');

  const setTabAndSave = (id) => { localStorage.setItem('sops_tab', id); setTab(id); };

  const activeTab = TABS.find(t => t.id === tab);

  function renderContent() {
    if (tab === 'policies') return <LabPolicies />;
    if (tab === 'meetings')       return <MeetingStandards />;
    if (tab === 'benchling')      return <BenchlingPolicy />;
    if (tab === 'tissue_culture') return <TissueCultureSOP />;
    if (tab === 'ordering')       return <OrderingSOP />;
    if (tab === 'reagent')         return <ReagentTab />;
    if (tab === 'sample_naming')   return <SampleNamingSOPs />;
    if (tab === 'mutational_data') return <MutationalDataSOP />;
    return <PlaceholderContent tab={activeTab} />;
  }

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      {/* Left sidebar */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Lab Policies & SOPs</h1>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTabAndSave(t.id)} style={{
              width: '100%', textAlign: 'left', padding: '8px 12px',
              background: tab === t.id ? 'var(--purple-faint)' : 'transparent',
              border: 'none',
              borderLeft: tab === t.id ? '3px solid var(--purple-primary)' : '3px solid transparent',
              borderRadius: '0 6px 6px 0',
              color: tab === t.id ? 'var(--purple-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 13, cursor: 'pointer', lineHeight: 1.4,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.comingSoon && (
                <span style={{ fontSize: 9, fontWeight: 700, background: '#FEF9E7', color: '#F39C12', border: '1px solid #FAD7A0', borderRadius: 8, padding: '1px 5px', flexShrink: 0 }}>NEW</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renderContent()}
      </div>
    </div>
  );
}
