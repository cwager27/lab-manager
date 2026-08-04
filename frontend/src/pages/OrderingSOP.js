const s = {
  card: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h1: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', margin: '0 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 6px' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 6 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  sub: { paddingLeft: 20, margin: '4px 0 4px' },
};

export default function OrderingSOP() {
  return (
    <div>
      {/* REQUESTOR FORM */}
      <div style={s.card}>
        <div style={s.h1}>Requestor Form</div>
        <ul style={s.ul}>
          <li style={s.li}>I verified that an equivalent reagent that can be used does not exist in the lab: <strong>YES</strong></li>
          <li style={s.li}>Best estimate of amount needed now (numeric value only):</li>
          <li style={s.li}>Units for stated needs (e.g., uL, mL, mg, g, rxn, box of 1000 tips, case of 10×1000 tips, 96-tip rack):</li>
          <li style={s.li}>Likelihood of needing additional quantities in next 3–6 months (High / Low / Not sure):</li>
          <li style={s.li}>I checked alternative vendors and confirm my request is most cost-effective: <strong>YES</strong></li>
          <li style={s.li}>Requested vendor still required if cheaper alternatives exist (YES / NO):</li>
          <li style={s.li}>If YES, explanation:</li>
          <li style={s.li}>For orders &gt;$400, I obtained at least 3 vendor quotes to identify the best price and shared them for approval: <strong>YES / NA</strong></li>
          <li style={s.li}>
            Will this reagent be used to introduce, modify, express, or propagate genetic material in cells or organisms (including bacteria, yeast, or other microorganisms)? (YES / NO)
            <p style={{ ...s.p, fontStyle: 'italic', marginTop: 4, marginBottom: 0 }}>E.g. plasmids, cloning or expression vectors, bacteria cultures used for cloning, CRISPR reagents (Cas proteins, guide RNAs, donor templates), base editors, prime editors, viral delivery systems (lentivirus, AAV, retrovirus, adenovirus), non-viral delivery methods (transfection reagents, electroporation or nucleofection systems), and reporters, tags, or regulatory elements (e.g., GFP, luciferase, FLAG, promoters, enhancers).</p>
          </li>
          <li style={s.li}>
            Does this request introduce NEW biological material into the lab that was not previously present? (YES/NO)
            <p style={{ ...s.p, fontStyle: 'italic', marginTop: 4, marginBottom: 0 }}>E.g., new cell lines of any species, organoids or stem-cell–derived models, primary cells, tissues or tissue-derived material, live or replication-competent biological agents, and engineered or modified biological materials received from collaborators.</p>
          </li>
          <li style={s.li}>All slides from 1:1 and lab/SOF meetings are updated in the shared folder with Mia (YES/NO)</li>
          <li style={s.li}>All slides from 1:1 and lab/SOF meetings are updated with the correct format (yy-mm-dd) (YES/NO)</li>
        </ul>
      </div>

      {/* LAB MANAGER FORM */}
      <div style={s.card}>
        <div style={s.h1}>Lab Manager Form</div>

        <ul style={s.ul}>
          <li style={s.li}>Last slide deck from the requestor in 1:1 folder: [yy/mm/dd]</li>
          <li style={s.li}>Last slide deck from the requestor in lab meetings folder: [yy/mm/dd]</li>
          <li style={s.li}>Requestor form entered in correct format and is complete: <strong>YES</strong></li>
          <li style={s.li}>
            For orders &lt;$400 where specific vendor is not required, I checked alternative products and pricing in (YES = I checked; NO = I didn't check; NA = requested vendor is required, therefore check is not applicable):
            <ul style={s.sub}>
              <li style={s.li}>Google:</li>
              <li style={s.li}>People Soft / eMarketPlace:</li>
              <li style={s.li}>People Soft / RUSH eMarketPlace:</li>
              <li style={s.li}>People Soft / Fisher Healthcare:</li>
              <li style={s.li}>People Soft / Life Technologies:</li>
              <li style={s.li}>People Soft / Sigma Aldrich:</li>
              <li style={s.li}>People Soft / Other punchouts if applicable:</li>
            </ul>
          </li>
          <li style={s.li}>If a cheaper vendor was identified, applicability is confirmed by the end user; without assuming suitability: YES / NO / NA (cheaper vendor not identified or requested vendor was required thus search not performed)</li>
          <li style={s.li}>For orders &gt;$400 I verified that at least 3 vendor quotes were obtained: YES (verified) / NO (not verified) / NA (order&lt;$400)</li>
        </ul>

        <div style={s.h2}>Itinerary Search (existence &amp; prior usage)</div>
        <ul style={s.ul}>
          <li style={s.li}>Itinerary searched by catalog number to assess both reagent existence and prior usage: YES/NO</li>
          <li style={s.li}>Itinerary searched by at least 3 key terms (3 entries can be multiple words) including specific terms to capture exact products and less specific words to capture potentially similar functionally relevant reagents to assess both reagent existence and prior usage: YES/NO</li>
          <li style={s.li}>Keywords used (comma-separated): ____________________</li>
          <li style={s.li}>The same or functionally equivalent reagent already in lab: YES / NO</li>
          <li style={s.li}>Prior users identified who have used this in the past (including requestor prior usage): n = ___</li>
        </ul>

        <div style={s.h2}>User Need Validation</div>
        <ul style={s.ul}>
          <li style={s.li}>All identified users contacted: YES/NO/NA (no other prior users)</li>
          <li style={s.li}>Expected total need over 3 or 6 (select) months is _______</li>
        </ul>

        <div style={s.h2}>Vendor and Package Size Selection</div>
        <ul style={s.ul}>
          <li style={s.li}>Order is original or changed (delete as appropriate)</li>
          <li style={s.li}>If changed:
            <ul style={s.sub}>
              <li style={s.li}>Price-per-unit comparison across vendors performed: YES / NO</li>
              <li style={s.li}>Original Vendor Size/Price: _______</li>
              <li style={s.li}>Selected Vendor Size/Price: _______</li>
              <li style={s.li}>Bigger sizes than selected if available from both select and other 2 cheapest vendors:
                <ul style={s.sub}>
                  <li style={s.li}>(vendor/price or NA): __________</li>
                  <li style={s.li}>(vendor/price or NA): __________</li>
                  <li style={s.li}>(vendor/price or NA): __________</li>
                </ul>
              </li>
              <li style={s.li}>Reason for selection (select all that apply):
                <ul style={s.sub}>
                  <li style={s.li}>☐ Matches expected total need</li>
                  <li style={s.li}>☐ Lowest price per unit</li>
                  <li style={s.li}>☐ Shelf-life / storage constraints</li>
                  <li style={s.li}>☐ Vendor availability / backorder risk</li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
