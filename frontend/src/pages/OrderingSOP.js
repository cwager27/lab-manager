import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const SOP_TEXT = `ORDERING SOP
Standard operating procedure for reagent and supply ordering

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUESTOR FORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Complete all items below before submitting an order request to the Lab Manager.

I verified that an equivalent reagent that can be used does not exist in the lab: YES

Best estimate of amount needed now (numeric value only): _______________________
Units for stated needs (e.g. µL, mL, mg, g, rxn, box of 1000 tips): _______________________
Likelihood of needing additional quantities in next 3–6 months (High / Low / Not sure): _______________________

I checked alternative vendors and confirm my request is most cost-effective: YES

Requested vendor still required if cheaper alternatives exist (YES / NO): _______________________
If YES, explanation: _______________________

For orders >$400, I obtained at least 3 vendor quotes to identify the best price and shared them for approval: YES / NA

Will this reagent be used to introduce, modify, express, or propagate genetic material in cells or organisms? (YES / NO)
  E.g. plasmids, cloning or expression vectors, bacterial cultures used for cloning, CRISPR reagents (Cas proteins, guide RNAs, donor templates), base editors, prime editors, viral delivery systems (lentivirus, AAV, retrovirus, adenovirus), non-viral delivery methods (transfection reagents, electroporation or nucleofection systems), and reporters, tags, or regulatory elements (e.g. GFP, luciferase, FLAG, promoters, enhancers).

Does this request introduce NEW biological material into the lab that was not previously present? (YES / NO)
  E.g. new cell lines of any species, organoids or stem-cell-derived models, primary cells, tissues or tissue-derived material, live or replication-competent biological agents, and engineered or modified biological materials received from collaborators.

All slides from 1:1 and lab/SOF meetings are updated in the shared folder with Mia: YES / NO
All slides from 1:1 and lab/SOF meetings are updated with the correct format (yy-mm-dd): YES / NO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAB MANAGER FORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Complete all checks below upon receiving an order request.

Last slide deck from the requestor in 1:1 folder [yy/mm/dd]: _______________________
Last slide deck from the requestor in lab meetings folder [yy/mm/dd]: _______________________
Requestor form entered in correct format and is complete: YES

VENDOR / COST CHECK (orders <$400 without required vendor)
YES = checked; NO = didn't check; NA = requested vendor is required

  Google: _______________________
  PeopleSoft / eMarketPlace: _______________________
  PeopleSoft / RUSH eMarketPlace: _______________________
  PeopleSoft / Fisher Healthcare: _______________________
  PeopleSoft / Life Technologies: _______________________
  PeopleSoft / Sigma Aldrich: _______________________
  PeopleSoft / Other punchouts (if applicable): _______________________

If a cheaper vendor was identified, applicability is confirmed by the end user (without assuming suitability): YES / NO / NA
For orders >$400: I verified that at least 3 vendor quotes were obtained: YES / NO / NA

INVENTORY SEARCH
Inventory searched by catalog number to assess both reagent existence and prior usage: YES / NO
Inventory searched by at least 3 key terms (including specific terms to capture exact products and less specific words to capture similar functionally relevant reagents): YES / NO
Keywords used (comma-separated): _______________________
The same or functionally equivalent reagent already in lab: YES / NO
Prior users identified who have used this in the past (including requestor): n = _______________________

USER NEED VALIDATION
All identified users contacted: YES / NO / NA (no other prior users)
Expected total need over 3 or 6 (select) months: _______________________

VENDOR AND PACKAGE SIZE SELECTION
Order is original or changed (delete as appropriate): _______________________

If changed:
  Price-per-unit comparison across vendors performed: YES / NO
  Original Vendor Size / Price: _______________________
  Selected Vendor Size / Price: _______________________
  Bigger sizes than selected if available from both selected and 2 cheapest other vendors:
    (vendor / price or NA): _______________________
    (vendor / price or NA): _______________________
    (vendor / price or NA): _______________________

REASON FOR SELECTION (select all that apply):
  Matches expected total need
  Lowest price per unit
  Shelf-life / storage constraints
  Vendor availability / backorder risk`;

export default function OrderingSOP() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(SOP_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Ordering SOP</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Standard operating procedure for reagent and supply ordering — Requestor and Lab Manager checklists</p>
        </div>
        <button onClick={handleCopy}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: copied ? '#EAF7F0' : 'var(--bg-primary)', color: copied ? '#1E8449' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy SOP'}
        </button>
      </div>

      <pre style={{
        margin: 0,
        padding: '24px 28px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        lineHeight: 1.8,
        color: 'var(--text-secondary)',
        fontFamily: 'inherit',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        userSelect: 'text',
      }}>
        {SOP_TEXT}
      </pre>
    </div>
  );
}
