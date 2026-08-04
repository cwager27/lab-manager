import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const s = {
  card:   { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h1:     { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', margin: '0 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  li:     { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 6 },
  italic: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, fontStyle: 'italic', margin: '4px 0 0' },
  plain:  { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '4px 0 0' },
  ol:     { paddingLeft: 24, margin: '0 0 8px' },
  alpha:  { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'lower-alpha' },
  roman:  { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'lower-roman' },
  circle: { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'circle' },
  num:    { paddingLeft: 28, margin: '4px 0 4px', listStyleType: 'decimal' },
};

const SOP_TEXT = `REQUESTOR FORM

1. I verified that an equivalent reagent that can be used does not exist in the lab: YES
2. Best estimate of amount needed now (numeric value only):
3. Units for stated needs (e.g., uL, mL, mg, g, rxn, box of 1000 tips, case of 10x1000 tips, 96-tip rack):
4. Likelihood of needing additional quantities in next 3-6 months (High / Low / Not sure):
5. I checked alternative vendors and confirm my request is most cost-effective: YES
6. Requested vendor still required if cheaper alternatives exist (YES / NO):
   a. If YES, explanation:
7. For orders >$400, I obtained at least 3 vendor quotes to identify the best price and shared them for approval: YES / NA
8. Will this reagent be used to introduce, modify, express, or propagate genetic material in cells or organisms (including bacteria, yeast, or other microorganisms)? (YES / NO)
   E.g. plasmids, cloning or expression vectors bacteria cultures used for cloning, CRISPR reagents (Cas proteins, guide RNAs, donor templates), base editors, prime editors, viral delivery systems (lentivirus, AAV, retrovirus, adenovirus), non-viral delivery methods (transfection reagents, electroporation or nucleofection systems), and reporters, tags, or regulatory elements (e.g., GFP, luciferase, FLAG, promoters, enhancers).
9. Does this request introduce NEW biological material into the lab that was not previously present? (YES/NO)
   E.g., new cell lines of any species, organoids or stem-cell-derived models, primary cells, tissues or tissue-derived material, live or replication-competent biological agents, and engineered or modified biological materials received from collaborators.
10. All slides from 1:1 and lab/SOF meetings are updated in the shared folder with Mia (YES/NO)
11. All slides from 1:1 and lab/SOF meetings are updated with the correct format (yy-mm-dd) (YES/NO)

LAB MANAGER FORM

1. Last slide deck from the requestor in 1:1 folder: [yy/mm/dd]
2. Last slide deck from the requestor in lab meetings folder: [yy/mm/dd]
3. Requestor form entered in correct format and is complete: YES
4. For orders <$400 where specific vendor is not required, I checked alternative products and pricing in (YES = I checked; NO = I didn't check; NA = requested vendor is required, therefore check is not applicable):
   (i)    Google:
   (ii)   People Soft/eMarketPlace:
   (iii)  People Soft/ RUSH eMarketPlace:
   (iv)   People Soft/ Fisher Healthcare:
   (v)    People Soft/ Life Technologies:
   (vi)   People Soft/ Sigma Aldrich:
   (vii)  People Soft/ Other punchouts if applicable:
5. If a cheaper vendor was identified, applicability is confirmed by the end user; without assuming suitability: YES / NO / NA (cheaper vendor not identified or requested vendor was required thus search not performed)
6. For orders >$400 I verified that at least 3 vendor quotes were obtained: YES (verified) / NO (not verified) / NA (order<$400)
7. Itinerary search (existence & prior usage)
   (i)   Itinerary searched by catalog number to assess both reagent existence and prior usage: YES/NO
   (ii)  Itinerary searched by at least 3 key terms (3 entries can be multiple words) including specific terms to capture exact products and less specific words to capture potentially similar functionally relevant reagents to assess both reagent existence and prior usage: YES/NO
   (iii) Keywords used (comma-separated): ____________________
   (iv)  The same or functionally equivalent reagent already in lab: YES / NO
   (v)   Prior users identified who have used this in the past (including requestor prior usage): n = ___
8. User need validation
   (i)  All identified users contacted: YES/NO/NA (no other prior users)
   (ii) Expected total need over 3 or 6 (select) months is _______
9. Vendor and package size selection if an original order was changed
   (i)   Order is original or changed (delete as appropriate)
   (ii)  If changed:
         o Price-per-unit comparison across vendors performed: YES / NO
         o Original Vendor Size/Price: _______
         o Selected Vendor Size/Price: _______
         o Bigger sizes than selected if available from both select and other 2 cheapest vendors:
              1. (vendor/price or NA): __________
              2. (vendor/price or NA): __________
              3. (vendor/price or NA): __________
   (iii) Reason for selection (select all that apply):
         [ ] Matches expected total need
         [ ] Lowest price per unit
         [ ] Shelf-life / storage constraints
         [ ] Vendor availability / backorder risk`;

export default function OrderingSOP() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(SOP_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: copied ? '#EAF7F0' : 'var(--bg-primary)', color: copied ? '#1E8449' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy SOP'}
        </button>
      </div>

      {/* REQUESTOR FORM */}
      <div style={s.card}>
        <div style={s.h1}>Requestor Form</div>
        <ol style={s.ol}>
          <li style={s.li}>I verified that an equivalent reagent that can be used does not exist in the lab: <strong>YES</strong></li>
          <li style={s.li}>Best estimate of amount needed now (numeric value only):</li>
          <li style={s.li}>Units for stated needs (e.g., uL, mL, mg, g, rxn, box of 1000 tips, case of 10×1000 tips, 96-tip rack):</li>
          <li style={s.li}>Likelihood of needing additional quantities in next 3–6 months (High / Low / Not sure):</li>
          <li style={s.li}>I checked alternative vendors and confirm my request is most cost-effective: <strong>YES</strong></li>
          <li style={s.li}>
            Requested vendor still required if cheaper alternatives exist (YES / NO):
            <ol style={s.alpha}>
              <li style={s.li}>If YES, explanation:</li>
            </ol>
          </li>
          <li style={s.li}>For orders &gt;$400, I obtained at least 3 vendor quotes to identify the best price and shared them for approval: <strong>YES / NA</strong></li>
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
      </div>

      {/* LAB MANAGER FORM */}
      <div style={s.card}>
        <div style={s.h1}>Lab Manager Form</div>
        <ol style={s.ol}>
          <li style={s.li}>Last slide deck from the requestor in 1:1 folder: [yy/mm/dd]</li>
          <li style={s.li}>Last slide deck from the requestor in lab meetings folder: [yy/mm/dd]</li>
          <li style={s.li}>Requestor form entered in correct format and is complete: <strong>YES</strong></li>
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
      </div>
    </div>
  );
}
