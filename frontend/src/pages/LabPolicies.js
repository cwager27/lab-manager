import { useRef } from 'react';

const purple = '#5a1e82';

const s = {
  card: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: purple, textDecoration: 'underline', margin: '0 0 14px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  ol: { paddingLeft: 20, margin: '0 0 8px' },
  sub: { paddingLeft: 16, margin: '4px 0 4px' },
  sub2: { paddingLeft: 32, margin: '4px 0 4px' },
  sub3: { paddingLeft: 48, margin: '4px 0 4px' },
};

const TOC_ITEMS = [
  { id: 'ibc',          label: 'Work requiring IBC approval' },
  { id: 'specimens',    label: 'Work with human specimens' },
  { id: 'bio_materials',label: 'Bringing biological materials into the lab' },
  { id: 'cell_lines',   label: 'Work with cell lines' },
  { id: 'shared',       label: 'Shared reagents' },
  { id: 'cleanliness',  label: 'Policy reminder: Cleanliness & lab order' },
  { id: 'orders',       label: 'Policy reminder: Order requests' },
];

export default function LabPolicies() {
  const refIbc = useRef(null);
  const refSpecimens = useRef(null);
  const refBioMaterials = useRef(null);
  const refCellLines = useRef(null);
  const refShared = useRef(null);
  const refCleanliness = useRef(null);
  const refOrders = useRef(null);

  const refMap = {
    ibc: refIbc,
    specimens: refSpecimens,
    bio_materials: refBioMaterials,
    cell_lines: refCellLines,
    shared: refShared,
    cleanliness: refCleanliness,
    orders: refOrders,
  };

  const scrollTo = (id) => refMap[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      {/* Intro */}
      <p style={{ ...s.p, margin: '0 0 4px' }}>This is your weekly reminder of lab policies. These requirements are not optional and exist to ensure NYU LH compliance and safe, functional lab operations. Please read carefully and follow exactly guidance over any work involving the following:</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px' }}>From: Sarah Wilcox-Adelman — April 2026</p>

      {/* TOC */}
      <div style={s.card}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Table of Contents</p>
        <ol style={s.ol}>
          {TOC_ITEMS.map(item => (
            <li key={item.id} style={{ marginBottom: 4 }}>
              <button
                onClick={() => scrollTo(item.id)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: purple, fontSize: 13, textDecoration: 'underline', textAlign: 'left' }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* 1. IBC Approval */}
      <div ref={refIbc} style={s.card}>
        <div style={s.h2}>1. Work requiring IBC approval</div>
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
      </div>

      {/* 2. Work with specimens */}
      <div ref={refSpecimens} style={s.card}>
        <div style={s.h2}>2. Work with human specimens</div>
        <p style={s.p}>Work with any human specimens obtained from anywhere other than public vendors <strong>cannot begin without Mia's approval</strong> to confirm IRB compliance, including those from biorepositories, collaborators, or any other sources.</p>
      </div>

      {/* 3. Bringing biological materials */}
      <div ref={refBioMaterials} style={s.card}>
        <div style={s.h2}>3. Bringing biological materials into the lab</div>
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
      </div>

      {/* 4. Work with cell lines */}
      <div ref={refCellLines} style={s.card}>
        <div style={s.h2}>4. Work with cell lines</div>
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
      </div>

      {/* 5. Shared reagents */}
      <div ref={refShared} style={s.card}>
        <div style={s.h2}>5. Shared reagents</div>
        <p style={s.p}>The following are <strong>not personal items</strong> and must be <strong>stored in specified shared lab locations</strong> (red boxes or Quartzy-defined locations).</p>
        <ul style={s.ul}>
          <li style={s.li}>Antibodies</li>
          <li style={s.li}>Cell lines</li>
          <li style={s.li}>Proteins and enzymes (including restriction enzymes)</li>
          <li style={s.li}>qPCR / RT-PCR reagents</li>
          <li style={s.li}>Vectors / plasmids</li>
          <li style={s.li}>DNA / RNA extraction kits</li>
        </ul>
      </div>

      {/* 6. Cleanliness */}
      <div ref={refCleanliness} style={s.card}>
        <div style={s.h2}>6. Policy reminder: Cleanliness &amp; lab order</div>
        <ul style={s.ul}>
          <li style={s.li}><strong style={{ color: purple }}>Gloves required</strong> in all lab spaces unless just passing through</li>
          <li style={s.li}><strong style={{ color: purple }}>Lab coats mandatory in TC rooms</strong> — no exceptions
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>Applies to all activities, including hoods, microscopy, fridge/freezers, and conversations</li>
            </ul>
          </li>
          <li style={s.li}><strong style={{ color: purple }}>Last user responsibility:</strong> turn off equipment (except bead baths) and TC hoods</li>
        </ul>
      </div>

      {/* 7. Order requests */}
      <div ref={refOrders} style={s.card}>
        <div style={s.h2}>7. Policy reminder: Order requests</div>
        <ul style={s.ul}>
          <li style={s.li}>Requests received by noon Tuesday or Friday are processed by noon the following business day</li>
          <li style={s.li}>Urgent requests require Mia's approval</li>
          <li style={s.li}>Requests without fully and correctly filled 'Notes' section will be returned.</li>
        </ul>
      </div>
    </div>
  );
}
