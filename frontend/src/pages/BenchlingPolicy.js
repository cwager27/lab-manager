const s = {
  section: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  h3: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 6px' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  sub: { paddingLeft: 16, margin: '4px 0 8px' },
  tag: (color) => ({ fontSize: 11, fontWeight: 700, background: color === 'green' ? '#EAF7F0' : color === 'blue' ? 'var(--purple-faint)' : '#FEF9E7', color: color === 'green' ? '#27AE60' : color === 'blue' ? 'var(--purple-primary)' : '#F39C12', border: `1px solid ${color === 'green' ? '#A9DFBF' : color === 'blue' ? 'var(--purple-border)' : '#FAD7A0'}`, borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginBottom: 8 }),
};

export default function BenchlingPolicy() {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Benchling Use and Entries Policy</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px' }}>Guidelines for Experimental Tracking and Reporting — Updated February 2025</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 24px' }}>The lab has put together guidelines on how to structure Benchling and notebook entries to make sure we are fully compliant with NYU institutional requirements.</p>

      {/* Section I */}
      <div style={s.section}>
        <div style={s.h2}>I. Types of Data and Reporting Guidelines</div>

        <div style={s.tag('green')}>a) Key Results</div>
        <p style={s.p}><strong>Definition:</strong> Any conclusive positive and negative results that (i) will ever lead to or directly be used in publications, presentations, grants, or patents; or (ii) advance, focus, or formulate existing or new biological and/or technical hypotheses or scientific directions.</p>
        <p style={s.p}>Require <strong>detailed recording in Benchling</strong> using the following format and sections:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Date:</strong> Single or multiple dates when experiment(s) were performed must be entered. Terms such as "various" or similar are not acceptable.</li>
          <li style={s.li}><strong>Lab notebook pages:</strong> Cross-reference lab notebook information (book ID and page numbers, e.g. SWA #1: pg 1–2). Entered dates must match the dates recorded in the marked lab notebook entries.</li>
          <li style={s.li}><strong>Category:</strong> qPCR, microscopy, western, live cell imaging, sequencing, tissue isolation, etc.</li>
          <li style={s.li}><strong>Experimental purpose:</strong> A brief statement of experiment purpose/hypothesis.</li>
          <li style={s.li}><strong>Protocol:</strong> Must contain 2 sections:
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>Exact protocol: a detailed protocol sufficient to enable independent reproducibility (comparable to Nature Protocols manuscripts). Any referenced protocols must be attached or linked as documents — web links are not acceptable. If general protocols are referenced, the exact steps performed must nevertheless be explicitly detailed (including exact reagents, amounts, dilutions, and conditions).</li>
              <li style={s.li}>Reagents/supplies: list exact reagents used in the format: 'reagent', 'vendor', 'cat number'.</li>
            </ul>
          </li>
          <li style={s.li}><strong>Results:</strong> Representative key and annotated images of results (images, summary graphs, gels/blots, etc.).</li>
          <li style={s.li}><strong>Conclusions:</strong> A brief statement of results/conclusions.</li>
          <li style={s.li}><strong>Raw data:</strong> Paths to raw data files on server OR uploads of raw data/measurements from instruments used.
            <br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Example: Petljak lab folder/Isabella/subfolder/file_name</span>
          </li>
        </ul>

        <div style={{ ...s.tag('blue'), marginTop: 16 }}>b) Other Results</div>
        <p style={s.p}><strong>Definition:</strong> Conclusive (positive AND negative) technical results that may not be published/pursued immediately but are relevant technical knowledge for the lab (e.g. experiments testing/optimizing various protocols/reagents/assays).</p>
        <p style={s.p}>Require less detailed Benchling recording (but standard lab notebook recording) using the following sections:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Date</strong></li>
          <li style={s.li}><strong>Lab notebook pages:</strong> Cross-reference lab notebook information (ID and page numbers)</li>
          <li style={s.li}><strong>Category:</strong> qPCR, microscopy, western, live cell imaging, sequencing, tissue isolation, etc.</li>
          <li style={s.li}><strong>Experimental purpose:</strong> A brief statement of experiment purpose/hypothesis.</li>
          <li style={s.li}><strong>Results and Conclusions:</strong> A brief statement of results/conclusions (i.e. reagents/concentrations/conditions that did not work, worked less well, or worked well but were not pursued and why).</li>
        </ul>

        <div style={{ ...s.tag('yellow'), marginTop: 16 }}>c) Large Scale Data</div>
        <p style={s.p}><strong>Definition:</strong> Experimentally generated data that cannot fully be stored on Benchling due to storage limits (e.g. live-cell imaging videos, large scale microscopy images).</p>
        <p style={s.p}>Require:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Storage on Server</strong> in user-designated folders in the format: <code>initials_date_experiment type</code> (e.g. mp_122124_FACS). Experiment types: FACS, imaging, gel, blot, RAW. Date in 'mmddyy' format.</li>
          <li style={s.li}><strong>Annotation in lab notebook</strong> using designated Orange stickers (ask Sarah) in top right corners, with file names annotated next to the sticker.</li>
          <li style={s.li}><strong>Annotation in Benchling</strong> for 'Key data' as per section (a) above.</li>
        </ul>

        <div style={{ ...s.section, background: 'var(--bg-secondary)', marginTop: 16, marginBottom: 0 }}>
          <p style={{ ...s.p, margin: 0 }}><strong>Irrelevant data:</strong> Defined as inconclusive experiments (e.g. failed for any reasons that we cannot learn from — wrong reagents used, accidents, equipment failures, contaminations). Require <em>only</em> lab notebook annotations and no electronic recording.</p>
        </div>
      </div>

      {/* Section II */}
      <div style={s.section}>
        <div style={s.h2}>II. Lab Notebook Format</div>
        <ul style={s.ul}>
          <li style={s.li}>Every notebook must be ID'd by individual's initials and consecutive number (e.g. SWA #1, SWA #2, …) on the spine with tape and on the cover page. Sarah will ID all notebooks to maintain consistency.</li>
          <li style={s.li}>Numbered pages must be visible so they can be used as cross-references for electronic reports.</li>
          <li style={s.li}>All entries must be dated.</li>
          <li style={s.li}>Where experiments included larger scale data, the allocated orange 'data sticker' has to be used in the upper right corner of the page, with file names if uploaded to Benchling and/or server annotated. Orange data stickers are in the office supply drawer in the lab.</li>
        </ul>
        <p style={{ ...s.p, fontSize: 12, color: 'var(--text-muted)' }}>Annotation file path example: Petljak lab folder/Isabella/subfolder/file_name</p>
      </div>

      {/* Section III */}
      <div style={s.section}>
        <div style={s.h2}>III. Benchling Format</div>
        <p style={s.p}><strong>Naming structure for projects:</strong></p>
        <ul style={s.ul}>
          <li style={s.li}>Person name (if shared project, then all names)
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}><strong>LAB NOTEBOOK</strong> (one folder per notebook with images of all used pages uploaded)
                <ul style={{ ...s.ul, ...s.sub }}>
                  <li style={s.li}>Lab notebook ID 1 (e.g. SWA #1)</li>
                  <li style={s.li}>Lab notebook ID 2 (e.g. SWA #2)</li>
                </ul>
              </li>
              <li style={s.li}><strong>Project 1_name</strong> (e.g. benzene mutagenicity)
                <ul style={{ ...s.ul, ...s.sub }}>
                  <li style={s.li}>Aim I (informative name, e.g. identifying dose for sequencing)</li>
                  <li style={s.li}>Aim II (informative name)</li>
                </ul>
              </li>
              <li style={s.li}><strong>Project 2_name</strong></li>
              <li style={s.li}><strong>Project 3_name</strong></li>
            </ul>
          </li>
        </ul>
        <p style={s.p}>All projects in Benchling are <strong>owned by the lab, not the individual</strong>. This has to be changed by clicking on the gear next to project name → Project Settings → Owner.</p>
      </div>

      {/* Section IV */}
      <div style={s.section}>
        <div style={s.h2}>IV. Compliance and Audit</div>

        <div style={s.h3}>Daily/Weekly</div>
        <p style={s.p}>To ensure data integrity and traceability, lab notebooks should be updated as experiments are performed and kept in a state that allows immediate review if selected for audit during the quarterly cycle:</p>
        <ul style={s.ul}>
          <li style={s.li}>Images of all laboratory notebook pages for the month are uploaded.</li>
          <li style={s.li}>All required data types (as defined in Sections a–b) are electronically recorded and formatted according to lab standards.</li>
          <li style={s.li}>Raw data are stored on the server in the correct directory and format.</li>
          <li style={s.li}>Notebook pages describing experiments that generate large-scale datasets include:
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>Orange data sticker in the top right corner of the input, and</li>
              <li style={s.li}>Correct cross-referenced file paths pointing to server-stored data.</li>
            </ul>
          </li>
        </ul>

        <div style={s.h3}>Quarterly</div>
        <ul style={s.ul}>
          <li style={s.li}>Each quarter, one lab member will be randomly selected for an audit without prior notice.</li>
          <li style={s.li}>The Lab Manager will work with the selected member for up to two weeks to identify and remediate any deficiencies.</li>
          <li style={s.li}>Corrected materials are submitted to the PI for review.</li>
          <li style={s.li}>Mia will provide written feedback.</li>
          <li style={s.li}>To allow sufficient time for implementation:
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>The same individual will not be audited in consecutive quarters.</li>
              <li style={s.li}>However, all identified issues must be resolved and reflected in the next audit cycle in which the individual is reviewed.</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
