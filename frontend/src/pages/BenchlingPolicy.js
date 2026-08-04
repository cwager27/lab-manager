const s = {
  section: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  sub: { paddingLeft: 16, margin: '4px 0 4px' },
};

export default function BenchlingPolicy() {
  return (
    <div>
      <p style={{ ...s.p, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Guidelines for Experimental Tracking and Reporting</p>
      <p style={{ ...s.p, fontWeight: 700, color: '#FF0000', margin: '0 0 4px' }}>The lab has put together guidelines on how to structure Benchling and notebook entries to make sure we are fully compliant with NYU institutional requirements.</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 24px' }}>Updated February 2025</p>

      {/* Section I */}
      <div style={s.section}>
        <div style={s.h2}>I. <u>Types of data and reporting guidelines</u></div>

        <p style={{ ...s.p, fontWeight: 700 }}>a) Key Results:</p>
        <p style={s.p}>Defined as any <strong>conclusive</strong> positive <em>and</em> negative results i) to ever lead to or directly be used in publications, presentations, grants, patents; as well as ii) any results advancing, focusing or formulating existing or new biological and/or technical hypotheses or scientific directions.</p>
        <p style={s.p}>Require detailed recording in Benchling using the following format and sections:</p>
        <ul style={s.ul}>
          <li style={s.li}><u>Date:</u> single or multiple dates when experiment(s) were performed must be entered. Terms such as 'various' or similar are not acceptable.</li>
          <li style={s.li}><u>Lab notebook pages:</u> Cross-reference lab notebook information (book ID and page numbers: eg SWA #1: pg 1-2). Entered dates must match the dates recorded in the marked lab notebook entries.</li>
          <li style={s.li}><u>Category</u> (qPCR, microscopy, western, live cell imaging, sequencing, tissue isolation, etc)</li>
          <li style={s.li}><u>Experimental purpose:</u> a brief statement of experiment purpose/hypothesis</li>
          <li style={s.li}><u>Protocol:</u> must contain 2 sections
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>Exact protocol: a detailed protocol sufficient to enable independent reproducibility (comparable to Nature Protocols manuscripts)</li>
              <li style={s.li}>Any referenced protocols must be attached or linked as documents (web links are not acceptable).</li>
              <li style={s.li}>If general protocols are referenced, the exact steps performed must nevertheless be explicitly detailed to generate the reported results (including exact reagents, amounts, dilutions, and conditions).</li>
              <li style={s.li}><u>Reagents/supplies</u>: list exact reagents used in the protocol in the format: 'reagent', 'vendor', 'cat number'</li>
            </ul>
          </li>
          <li style={s.li}><u>Results:</u> Representative key and annotated images of results (images, summary graphs, gels/blots etc)</li>
          <li style={s.li}><u>Conclusions:</u> a brief statement of results/conclusions</li>
          <li style={s.li}><u>Raw data:</u> Paths to raw data files on server OR uploads of raw data/measurements from instruments used (eg FACS etc).
            <br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Annotation file path example: Petljak lab folder/Isabella/subfolder/file_name</span>
          </li>
        </ul>

        <p style={{ ...s.p, fontWeight: 700, marginTop: 16 }}>b) Other results:</p>
        <p style={s.p}>Defined as <strong>conclusive (positive AND negative) technical results that may not be published/pursued and used immediately</strong> but are relevant technical knowledge for the lab (eg: experiments testing/optimizing various protocols/reagents/assays). Require less detailed Benchling recording (but standard lab notebook recording) using the following format and sections:</p>
        <ul style={s.ul}>
          <li style={s.li}><u>Date</u></li>
          <li style={s.li}><u>Lab notebook pages:</u> cross-reference lab notebook information where protocols are detailed as normally (ID and page numbers: eg SWA #1: pg 1-2)</li>
          <li style={s.li}><u>Category:</u> (qPCR, microscopy, western, live cell imaging, sequencing, tissue isolation, etc)</li>
          <li style={s.li}><u>Experimental purpose:</u> a brief statement of experiment purpose/hypothesis</li>
          <li style={s.li}><u>Results and Conclusions:</u> a brief statement of results/conclusions (ie reagents/concentrations/conditions that did not work or worked less well or worked well but were not pursued and why were they less prioritized)</li>
        </ul>

        <p style={{ ...s.p, fontWeight: 700, marginTop: 16 }}>c) Large scale data:</p>
        <p style={s.p}>Defined as experimentally generated data that cannot fully be stored on Benchling due to storage limits such as live-cell imaging videos, large scale microscopy images etc.</p>
        <p style={s.p}>Require:</p>
        <ul style={s.ul}>
          <li style={s.li}>storage in user-designated folders on Server in a format:
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>initials_date_experiment type &nbsp; eg mp_122124_FACS</li>
              <li style={s.li}>experiment type e.g., FACS, imaging, gel, blot, RAW</li>
              <li style={s.li}>date in 'mmddyy' format</li>
            </ul>
          </li>
          <li style={s.li}>annotation in lab notebook for all data types using designated Orange stickers (ask Sarah) in top right corners and annotating file names next to the sticker. Annotate so others can find file.
            <br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Annotation file path example: Petljak lab folder/Isabella/subfolder/file_name</span>
          </li>
          <li style={s.li}>annotation in Benchling for 'Key data' as per above</li>
        </ul>

        <ul style={s.ul}>
          <li style={s.li}><strong>Irrelevant data</strong></li>
        </ul>
        <p style={s.p}>Defined as inconclusive experiments e.g. failed for any reasons that we cannot learn from (eg wrong reagents used, accidents, equipment failures, contaminations etc). Require only lab notebook annotations and no electronic recording.</p>
      </div>

      {/* Section II */}
      <div style={s.section}>
        <div style={s.h2}>II. <u>Lab Notebook</u> Format</div>
        <ul style={s.ul}>
          <li style={s.li}>Every notebook must be ID'd by individual's initials and consecutive number (i.e. SWA #1, SWA#2, …) on spine with tape and on cover page. Sarah will ID all notebooks to maintain consistency.</li>
          <li style={s.li}>Numbered pages must be visible so can be used as cross-reference for electronic reports.</li>
          <li style={s.li}>All entries must be dated.</li>
          <li style={s.li}>Where experiments included larger scale data, allocated orange 'data sticker' has to be used in the upper right corner of page; with file names if uploaded to Benchling and/or server annotated. Orange data stickers are in office supply drawer in lab.</li>
        </ul>
        <p style={{ ...s.p, fontSize: 12, color: 'var(--text-muted)' }}>Annotation file path example: Petljak lab folder/Isabella/subfolder/file_name</p>
      </div>

      {/* Section III */}
      <div style={s.section}>
        <div style={s.h2}>III. <u>Benchling</u> Format</div>
        <ul style={s.ul}>
          <li style={s.li}>Naming structure for projects:
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>Person name (if shared project then all names)
                <ul style={{ ...s.ul, ...s.sub }}>
                  <li style={s.li}><strong>LAB NOTEBOOK</strong> (one folder per notebook with images of all used pages uploaded)
                    <ul style={{ ...s.ul, ...s.sub }}>
                      <li style={s.li}>Lab notebook ID1 (eg SWA #1)</li>
                      <li style={s.li}>Lab notebook ID2 (eg SWA #2)</li>
                      <li style={s.li}>etc</li>
                    </ul>
                  </li>
                  <li style={s.li}>Project 1_name (eg benzene mutagenicity)
                    <ul style={{ ...s.ul, ...s.sub }}>
                      <li style={s.li}>Aim I (informative name eg identifying dose for sequencing)</li>
                      <li style={s.li}>Aim II (informative name)</li>
                    </ul>
                  </li>
                  <li style={s.li}>Project 2_name</li>
                  <li style={s.li}>Project 3_name</li>
                </ul>
              </li>
            </ul>
          </li>
          <li style={s.li}>All projects in Benchling are owned by lab not individual. This has to be changed by clicking on gear next to project name → project settings → owner.</li>
        </ul>
      </div>

      {/* Section IV */}
      <div style={s.section}>
        <div style={s.h2}>IV. <u>Compliance</u> and Audit</div>

        <p style={s.p}><strong><em>Daily/weekly:</em></strong> To ensure data integrity and traceability, lab notebooks should be updated as experiments are performed and kept in a state that allows immediate review if selected for audit during the quarterly cycle.</p>
        <ul style={s.ul}>
          <li style={s.li}>Images of all laboratory notebook pages for the month are uploaded.</li>
          <li style={s.li}>All required data types (as defined in Sections a–b) are electronically recorded and formatted according to lab standards.</li>
          <li style={s.li}>Raw data are stored on the server in the correct directory and format.</li>
          <li style={s.li}>Notebook pages describing experiments that generate large-scale datasets include:
            <ul style={{ ...s.ul, ...s.sub }}>
              <li style={s.li}>Orange data sticker top right corner of the input, and</li>
              <li style={s.li}>Correct cross-referenced file paths pointing to server-stored data.</li>
            </ul>
          </li>
        </ul>

        <p style={s.p}><strong><em>Quarterly:</em></strong></p>
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
