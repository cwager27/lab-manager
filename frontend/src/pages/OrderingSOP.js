const s = {
  section: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  h3: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 6px' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 6 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  fieldRow: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, flex: '0 0 auto' },
  fieldNote: { fontSize: 12, color: 'var(--text-muted)', flex: 1 },
  checkItem: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  checkbox: { width: 16, height: 16, border: '1.5px solid var(--border)', borderRadius: 3, flexShrink: 0, marginTop: 2 },
};

function CheckItem({ children, sub }) {
  return (
    <div style={{ ...s.checkItem, marginLeft: sub ? 26 : 0 }}>
      <div style={s.checkbox} />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</span>
    </div>
  );
}

function BlankLine({ label, indent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, marginLeft: indent ? 26 : 0 }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ flex: 1, borderBottom: '1px solid var(--border)', minWidth: 40 }} />
    </div>
  );
}

export default function OrderingSOP() {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Ordering SOP</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 24px' }}>Standard operating procedure for reagent and supply ordering — Requestor and Lab Manager checklists</p>

      {/* Requestor Form */}
      <div style={s.section}>
        <div style={s.h2}>Requestor Form</div>
        <p style={s.p}>Complete all items below before submitting an order request to the Lab Manager.</p>

        <CheckItem>I verified that an equivalent reagent that can be used does not exist in the lab: <strong>YES</strong></CheckItem>
        <BlankLine label="Best estimate of amount needed now (numeric value only):" />
        <BlankLine label="Units for stated needs (e.g. µL, mL, mg, g, rxn, box of 1000 tips):" />
        <BlankLine label="Likelihood of needing additional quantities in next 3–6 months (High / Low / Not sure):" />

        <div style={{ height: 8 }} />
        <CheckItem>I checked alternative vendors and confirm my request is most cost-effective: <strong>YES</strong></CheckItem>
        <BlankLine label="Requested vendor still required if cheaper alternatives exist (YES / NO):" />
        <BlankLine label="If YES, explanation:" />

        <div style={{ height: 8 }} />
        <CheckItem>For orders &gt;$400, I obtained at least 3 vendor quotes to identify the best price and shared them for approval: <strong>YES / NA</strong></CheckItem>
        <CheckItem>Will this reagent be used to introduce, modify, express, or propagate genetic material in cells or organisms? (YES / NO)
          <br />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
            E.g. plasmids, cloning or expression vectors, bacterial cultures used for cloning, CRISPR reagents (Cas proteins, guide RNAs, donor templates), base editors, prime editors, viral delivery systems (lentivirus, AAV, retrovirus, adenovirus), non-viral delivery methods (transfection reagents, electroporation or nucleofection systems), and reporters, tags, or regulatory elements (e.g. GFP, luciferase, FLAG, promoters, enhancers).
          </span>
        </CheckItem>
        <CheckItem>Does this request introduce NEW biological material into the lab that was not previously present? (YES / NO)
          <br />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
            E.g. new cell lines of any species, organoids or stem-cell-derived models, primary cells, tissues or tissue-derived material, live or replication-competent biological agents, and engineered or modified biological materials received from collaborators.
          </span>
        </CheckItem>
        <CheckItem>All slides from 1:1 and lab/SOF meetings are updated in the shared folder with Mia: <strong>YES / NO</strong></CheckItem>
        <CheckItem>All slides from 1:1 and lab/SOF meetings are updated with the correct format (yy-mm-dd): <strong>YES / NO</strong></CheckItem>
      </div>

      {/* Lab Manager Form */}
      <div style={s.section}>
        <div style={s.h2}>Lab Manager Form</div>
        <p style={s.p}>Complete all checks below upon receiving an order request.</p>

        <BlankLine label="Last slide deck from the requestor in 1:1 folder: [yy/mm/dd]" />
        <BlankLine label="Last slide deck from the requestor in lab meetings folder: [yy/mm/dd]" />
        <CheckItem>Requestor form entered in correct format and is complete: <strong>YES</strong></CheckItem>

        <div style={s.h3}>Vendor / Cost Check (orders &lt;$400 without required vendor)</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>YES = checked; NO = didn't check; NA = requested vendor is required</p>
        {[
          'Google',
          'PeopleSoft / eMarketPlace',
          'PeopleSoft / RUSH eMarketPlace',
          'PeopleSoft / Fisher Healthcare',
          'PeopleSoft / Life Technologies',
          'PeopleSoft / Sigma Aldrich',
          'PeopleSoft / Other punchouts (if applicable)',
        ].map(v => <BlankLine key={v} label={v + ':'} indent />)}
        <CheckItem>If a cheaper vendor was identified, applicability is confirmed by the end user (without assuming suitability): <strong>YES / NO / NA</strong></CheckItem>
        <CheckItem>For orders &gt;$400: I verified that at least 3 vendor quotes were obtained: <strong>YES / NO / NA</strong></CheckItem>

        <div style={s.h3}>Inventory Search</div>
        <CheckItem>Inventory searched by <strong>catalog number</strong> to assess both reagent existence and prior usage: YES / NO</CheckItem>
        <CheckItem>Inventory searched by at least <strong>3 key terms</strong> (including specific terms to capture exact products and less specific words to capture similar functionally relevant reagents): YES / NO</CheckItem>
        <BlankLine label="Keywords used (comma-separated):" />
        <BlankLine label="The same or functionally equivalent reagent already in lab: YES / NO" />
        <BlankLine label="Prior users identified who have used this in the past (including requestor): n =" />

        <div style={s.h3}>User Need Validation</div>
        <CheckItem>All identified users contacted: <strong>YES / NO / NA (no other prior users)</strong></CheckItem>
        <BlankLine label="Expected total need over 3 or 6 (select) months:" />

        <div style={s.h3}>Vendor and Package Size Selection</div>
        <BlankLine label="Order is original or changed (delete as appropriate):" />
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '8px 0 4px' }}>If changed:</p>
        <CheckItem sub>Price-per-unit comparison across vendors performed: YES / NO</CheckItem>
        <BlankLine label="Original Vendor Size / Price:" indent />
        <BlankLine label="Selected Vendor Size / Price:" indent />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 4px 26px' }}>Bigger sizes than selected if available from both selected and 2 cheapest other vendors:</p>
        <BlankLine label="(vendor / price or NA):" indent />
        <BlankLine label="(vendor / price or NA):" indent />
        <BlankLine label="(vendor / price or NA):" indent />

        <div style={s.h3}>Reason for Selection (select all that apply)</div>
        <div style={{ marginLeft: 0 }}>
          {['Matches expected total need', 'Lowest price per unit', 'Shelf-life / storage constraints', 'Vendor availability / backorder risk'].map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={s.checkbox} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
