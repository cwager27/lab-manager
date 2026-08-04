import { useRef } from 'react';

const purple = '#79469b';
const red = '#ff0000';

const s = {
  card: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h1: { fontSize: 16, fontWeight: 700, color: purple, textDecoration: 'underline', margin: '0 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  pli: { fontSize: 13, color: purple, lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  ol: { paddingLeft: 20, margin: '0 0 8px' },
  circle: { paddingLeft: 20, margin: '4px 0 4px', listStyleType: 'circle' },
  alpha: { paddingLeft: 20, margin: '4px 0 4px', listStyleType: 'lower-alpha' },
};

// Numbered list item: purple number, black text. Pass red=true for all-red.
function PLI({ children, red: isRed, style }) {
  return (
    <li style={{ ...s.pli, ...(isRed ? { color: red, fontWeight: 700 } : {}), ...style }}>
      {isRed ? children : <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{children}</span>}
    </li>
  );
}

// Lettered sub-item: purple letter, black text
function ALI({ children }) {
  return (
    <li style={{ ...s.pli, fontWeight: 400 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{children}</span>
    </li>
  );
}

const TOC_ITEMS = [
  { id: 'general_rules',     label: '1. General Rules' },
  { id: 'bsc',               label: '2. BioSafety Cabinet (BSC) Use' },
  { id: 'media_prep',        label: '3. Media Preparation — Cancer Lines' },
  { id: 'freezing_media',    label: '4. Freezing Media Recipe — Cancer Lines' },
  { id: 'conditioned_media', label: '5. Conditioned Media Preparation' },
  { id: 'thawing',           label: '6. Thawing Cells — Cancer Lines' },
  { id: 'adherent',          label: '7. Maintaining Adherent Cells' },
  { id: 'suspension',        label: '8. Subculturing Suspension Cells' },
  { id: 'freezing_cells',    label: '9. Freezing Cells — Cancer Lines' },
  { id: 'counting',          label: '10. Counting Cells (Demovix Cell Drop)' },
  { id: 'mycoplasma',        label: '11. Mycoplasma Testing' },
];

export default function TissueCultureSOP() {
  const refGeneralRules = useRef(null);
  const refBsc          = useRef(null);
  const refMediaPrep    = useRef(null);
  const refFreezingMedia = useRef(null);
  const refConditionedMedia = useRef(null);
  const refThawing      = useRef(null);
  const refAdherent     = useRef(null);
  const refSuspension   = useRef(null);
  const refFreezingCells = useRef(null);
  const refCounting     = useRef(null);
  const refMycoplasma   = useRef(null);

  const refMap = {
    general_rules: refGeneralRules, bsc: refBsc, media_prep: refMediaPrep,
    freezing_media: refFreezingMedia, conditioned_media: refConditionedMedia,
    thawing: refThawing, adherent: refAdherent, suspension: refSuspension,
    freezing_cells: refFreezingCells, counting: refCounting, mycoplasma: refMycoplasma,
  };

  const scrollTo = (id) => refMap[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      {/* Lab logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
        <img src="/dna-logo.jpg" alt="Petljak Lab" style={{ width: 64, height: 64, objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#5b3d8a', letterSpacing: '0.18em' }}>PETLJAK</span>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#5b3d8a', letterSpacing: '0.45em', marginTop: 2 }}>LAB</span>
        </div>
      </div>

      {/* Document title */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 33, fontWeight: 700, color: purple, textDecoration: 'underline', margin: '0 0 4px', lineHeight: 1.2 }}>
          TISSUE CULTURE (TC) PROTOCOLS
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Updated December 2025</p>
      </div>

      {/* Table of Contents */}
      <div style={s.card}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Table of Contents</p>
        <ol style={s.ol}>
          {TOC_ITEMS.map(item => (
            <li key={item.id} style={{ marginBottom: 4 }}>
              <button onClick={() => scrollTo(item.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: purple, fontSize: 13, textDecoration: 'underline', textAlign: 'left' }}>
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* 1. GENERAL RULES */}
      <div ref={refGeneralRules} style={s.card}>
        <div style={s.h1}>1. General Rules</div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#3d1f1f', background: '#f2d0cc', borderRadius: 6, padding: '14px 18px', textAlign: 'center', lineHeight: 1.7, margin: '0 0 16px' }}>
          These rules were put together to minimize the risk of contamination as well as health risks. Deviation from these rules can result in access ban. If you notice any non-compliance, please email Mia directly.
        </p>
        <p style={{ ...s.p, color: 'var(--text-primary)' }}>Rules applicable whenever working in the TC room:</p>

        <p style={{ fontSize: 13, fontWeight: 700, color: red, margin: '12px 0 4px' }}>DISPOSABLE LAB COATS</p>
        <ul style={s.ul}>
          <li style={s.li}>Should be put on immediately when entering the TC room and worn at all times.</li>
          <li style={s.li}>Should never be used outside of the TC room.</li>
          <li style={s.li}>Should be replaced with a new coat and labeled each week.</li>
        </ul>

        <p style={{ fontSize: 13, fontWeight: 700, color: red, margin: '8px 0 4px' }}>GLOVES</p>
        <ul style={s.ul}>
          <li style={s.li}>Should be put on and disinfected with 70% ethanol immediately upon entering the TC room.</li>
          <li style={s.li}>Nothing can be touched in the TC room before the gloves are worn and disinfected.</li>
          <li style={s.li}>If bringing in labware from outside the TC, replace gloves when entering the room.</li>
        </ul>

        <p style={{ fontSize: 13, fontWeight: 700, color: red, margin: '8px 0 4px' }}>TC EQUIPMENT</p>
        <ul style={s.ul}>
          <li style={s.li}>Any reagents, supplies, or equipment brought to the TC should be 70% ethanol cleaned.</li>
          <li style={s.li}>The TC room has designated pipette controllers and serological pipettes. The pipette controllers are currently charged in the main lab in the bay by the microwave. Bring them into the TC room with gloves on, spray with 70% ethanol, replace gloves, and respray new gloves.</li>
          <li style={s.li}>The TC room has designated tube racks, markers, and other supplies that should not leave the room or be used for anything non-TC related.</li>
        </ul>

        <p style={{ fontSize: 13, fontWeight: 700, color: red, margin: '8px 0 4px' }}>REAGENTS and SUPPLIES</p>
        <ul style={s.ul}>
          <li style={s.li}>Use of autoclaved/recycled supplies in TC is strictly forbidden.</li>
          <li style={s.li}>Each user has their own labelled media and TrypLE for cell culture.</li>
          <li style={s.li}>Sterile, individually wrapped pipettes and aspirators are used for cell culture.</li>
          <li style={s.li}>Only filtered tips are used for cell culture. Use of non-filtered tips is banned in BSC.</li>
          <li style={s.li}>Cleaning supplies: 70% ethanol, 10% bleach, and detergent and distilled water (both using autoclaved, distilled water).</li>
          <li style={s.li}>If you notice low stocks of anything please tell Sarah.</li>
        </ul>

        <p style={{ fontSize: 13, fontWeight: 700, color: red, margin: '8px 0 4px' }}>WARMING BATH</p>
        <ul style={s.ul}>
          <li style={s.li}>Anything going in has to be cleaned with 70% ethanol first.</li>
        </ul>

        <p style={{ fontSize: 13, fontWeight: 700, color: red, margin: '8px 0 4px' }}>BIOSAFETY CABINET (BSC) USE</p>
        <ul style={s.ul}>
          <li style={s.li}>Anything entering BSC has to be cleaned with 70% ethanol first.</li>
          <li style={s.li}>Disinfect your gloves every time they enter the BSC, even if your hands were out only shortly.</li>
          <li style={s.li}>BSCs have to be cleaned before and after use as per the instructions in this document.</li>
          <li style={s.li}>VacTrap is to be emptied whenever waste reaches levels designated on the VacTrap, as well as by the last user every Friday regardless of level in container.</li>
          <li style={s.li}>BSC needs to be closed by the last user every day.</li>
        </ul>
      </div>

      {/* 2. BSC USE */}
      <div ref={refBsc} style={s.card}>
        <div style={s.h1}>2. BioSafety Cabinets (BSC) Use</div>
        <p style={{ ...s.p, fontWeight: 700 }}>Note: NYU policy is explicit that UV lights may not be used in BSC so do not turn it on</p>
        <ol style={s.ol}>
          <PLI>Raise the BSC sash to the correct level, which is evident by a mark or an alarm that ceases at correct height, and run the fan for <strong>20 minutes</strong> before use.</PLI>
          <PLI>Check that the VacTrap top is tightly screwed on the bottle, turn on and confirm suction.</PLI>
          <PLI>Clean the BSC interior before use (if opening BSC, clean after 15 minutes of fan running &amp; leave for 5 mins to dry)
            <ul style={s.circle}>
              <li style={s.li}>if visible stains (e.g. dried media): first wipe with detergent pre-prepared with autoclaved water, then wipe with 10% bleach, then 70% ethanol (EtOH)</li>
              <li style={s.li}>if no stains: wipe with 10% bleach, then 70% EtOH</li>
            </ul>
          </PLI>
          <PLI red>All reagents, supplies and your gloves need to be disinfected before entering the BSC
            <ul style={s.circle}>
              <li style={s.li}>Gloves: spray with 70% EtOH <strong>every time</strong> your hands enter the BSC (ie even if they were out for a short period of time)</li>
              <li style={s.li}>Anything plastic/impervious to liquid (no exposed paper/filters): spray with 70% EtOH</li>
              <li style={s.li}>Wrappers from serological and aspirating pipets: wipe with 70% EtOH-sprayed kimwipes</li>
              <li style={s.li}>Exception: do not spray or wipe down flasks or plates taken from incubators that are currently holding cells to prevent 'sloshing', lifting of plate top, wetting of flask-top filter, and contamination</li>
            </ul>
          </PLI>
          <PLI>Clean the BSC at the end of the use following steps under #3</PLI>
          <PLI>Turn off the fan unless another individual is going to use BSC</PLI>
          <PLI>Check the VacTrap waste level. If the waste is at or above the first marked line (50% full), remove it and bring to the sink. Add bleach equal to 10% of the total volume, swirl to mix, dump the liquid down the sink, and rinse out the bottle. Add enough Bacdown Disinfectant soap to cover the bottom. Place the VacTrap back under the BSC with the lid loose to allow water to evaporate.</PLI>
        </ol>
      </div>

      {/* 3. MEDIA PREP */}
      <div ref={refMediaPrep} style={s.card}>
        <div style={s.h1}>3. Media Preparation — Cancer Lines</div>
        <ol style={s.ol}>
          <PLI>Bring media (DMEM:F12 or RPMI; stored at 4°C), FBS and pen/strep aliquots (both -20°C) to the TC, spray with 70% EtOH, and place in a warming bath at 37°C. <em>Note: If only preparing media and not using it immediately, you do not need to prewarm — you only need to thaw the supplements.</em></PLI>
          <PLI>Once aliquots are thawed, spray them and a media bottle with 70% EtOH, wipe, and place in the BSC.</PLI>
          <PLI>Bring serological pipettes and pipettor, disinfect with 70% EtOH, wipe and place in BSC.</PLI>
          <PLI>Unscrew caps/lids from all bottles (media, supplements) but leave them on.</PLI>
          <PLI>Add supplements to the media. Both RPMI and DMEM:F12 require:
            <ul style={s.circle}>
              <li style={s.li}><strong>10% FBS</strong> — add 50 mL aliquot directly to the bottle using pipette.</li>
              <li style={s.li}><strong>1× PenStrep</strong> — add 5 mL aliquot directly to the bottle.</li>
            </ul>
          </PLI>
          <PLI>Clearly mark on the bottle: your initials, date, 10% FBS, 1× pen/strep, and any other supplements/reagents added.</PLI>
          <PLI>Once done with TC work, store the media at 4°C for later use.</PLI>
        </ol>
      </div>

      {/* 4. FREEZING MEDIA */}
      <div ref={refFreezingMedia} style={s.card}>
        <div style={s.h1}>4. Freezing Media Recipe — Cancer Lines</div>
        <ul style={s.ul}>
          <li style={s.li}>Fetal bovine serum (FBS) or other serum (20%)</li>
          <li style={s.li}>Dimethyl sulfoxide (DMSO) (10%)</li>
          <li style={s.li}>RPMI or DMEM media (70%)</li>
        </ul>
      </div>

      {/* 5. CONDITIONED MEDIA */}
      <div ref={refConditionedMedia} style={s.card}>
        <div style={s.h1}>5. Conditioned Media Preparation - Cancer Lines</div>
        <ul style={s.ul}>
          <li style={s.li}>The length of time for cells to create conditioned media is dependent on cell type</li>
          <li style={s.li}>The general recommendation is that fresh media is added to ~50-60% confluent/dense lines and left for 1-2 days (<span style={{ color: red, fontWeight: 700 }}>until turns orange but not yellow</span>) before collecting and preparing.</li>
        </ul>
        <ol style={s.ol}>
          <PLI>Set up BSC for use as per section #2.</PLI>
          <PLI>Bring cell lines that were a priori incubated at ~50-60% confluency for ~2 days to BSC.</PLI>
          <PLI>Collect media from lines into 50mL falcons, and add fresh media to the lines - return cell lines to the incubator.</PLI>
          <PLI>Spin the collected media for approximately 2 minutes at 2000 RPM.</PLI>
          <PLI>Disinfect the falcons and bring them back to BSC carefully so as not to disturb the cell pellet.</PLI>
          <PLI>Collect the media from the falcon into a new one, carefully not to disturb the pellet, leaving ~1 mL of media behind.</PLI>
          <PLI>Repeat the spinning and collection process into a new falcon, leaving ~1 mL media behind.</PLI>
          <PLI>Filter media through appropriate filters depending on the sizes of the proteins you wish to collect. For general conditioned media collected to enhance/help the growth of the lines: Corning low-protein binding filters are recommended.</PLI>
          <PLI>Leave the media in the bottle (or move to 50mL falcon); labelling with your initials, date of collection, name of the line from which collected.</PLI>
          <PLI>The collected media can be stored at 4°C. <span style={{ color: red, fontWeight: 700 }}>Do NOT store at -20C</span></PLI>
        </ol>
      </div>

      {/* 6. THAWING CELLS */}
      <div ref={refThawing} style={s.card}>
        <div style={s.h1}>6. Thawing Cells — Cancer Lines</div>
        <p style={{ ...s.p, fontStyle: 'italic' }}>To request a cell line, contact Sarah. She maintains a lab record of all cell lines and will retrieve the requested cell line from liquid nitrogen and place it in the -80°C freezer.</p>
        <ol style={s.ol}>
          <PLI><strong>New lines</strong> (newly purchased or obtained from collaborators) must be placed in the designated isolation incubator until testing negative for mycoplasma. If positive, inform Sarah immediately.</PLI>
          <PLI>Bring complete media (see Section 3) to the TC, spray with 70% EtOH, wipe down, and place in a warming bath at 37°C. Leave for ~30 minutes.</PLI>
          <PLI>While the media is warming, prepare the BSC for use as described in Section 2.</PLI>
          <PLI>Prepare T25 flasks (one flask per vial of cells being thawed). Remove flasks from their bags just outside the BSC, and place them directly into the BSC. Do not allow the bags to enter the BSC.</PLI>
          <PLI>Prepare sterile pipettes, aspirating pipettes, and pipetman. Spray pipetman with 70% EtOH; wipe wrappers with 70% EtOH-sprayed kimwipe. Place in BSC.</PLI>
          <PLI>Spray the cryotube holder with 70% EtOH, wipe down, and place in BSC.</PLI>
          <PLI>Once media is warm, spray the media bottle with 70% EtOH, wipe and place in the BSC. Turn T25 flasks vertically, unscrew caps but leave them on. Add 5 mL of media to each flask using a 5 mL pipette. Hold the caps by their outer sides to avoid contact with the inside, filters, or neck of the flask. Do not place the caps on the BSC surface; hold them while filling the flasks and replace them immediately without screwing them on. Ensure the pipette does not touch the outer edge of the media bottle neck when drawing media.</PLI>
          <PLI>Bring cell vials into the TC, spray with 70% ethanol, wipe, and place in the warming bath to thaw. Carefully monitor the thawing process, as it takes only 1-1.5 minutes. <span style={{ color: red, fontWeight: 700 }}>To avoid cell damage from prolonged exposure to DMSO, check the vials every ~40 seconds, and remove them as soon as they are fully thawed. Quickly proceed to transferring the cells into media.</span> If new to cell culture, proceed with 1 vial at the time given this process is time sensitive.</PLI>
          <PLI>Spray vials with 70% EtOH, wipe them, and place them into the vial holder in BSC.</PLI>
          <PLI>Work with one cryovial at the time i.e. <span style={{ color: red, fontWeight: 700 }}>never have &gt;1 cryovial open at the same time.</span></PLI>
          <PLI>Open the cryovial and <span style={{ color: red, fontWeight: 700 }}>gently</span> (cells are sensitive at this stage) extract cells using a 1 mL sterile transfer pipette. Gently place the cell solution into the media in the T25 flask, screw on the cap, place horizontally, and move the flask in a cross pattern to distribute cells evenly. Label the flask with initials, date, cell line, and passage number.</PLI>
          <PLI>Once complete with all flasks, place them in the incubator and clean the BSC.</PLI>
          <PLI>Replace media with fresh media after 24 hours or once cells become adherent to remove residual DMSO. Transfer cells to larger flasks once confluent.</PLI>
        </ol>
      </div>

      {/* 7. ADHERENT CELLS */}
      <div ref={refAdherent} style={s.card}>
        <div style={s.h1}>7. Maintaining Adherent Cells - Cancer Lines</div>
        <ul style={s.ul}>
          <li style={s.li}>Work with one cell line at a time to limit cross-contamination</li>
          <li style={s.li}>Cells should be split when about 80% confluent</li>
          <li style={s.li}>Cells can remain in the same flask for ~30 days depending on the line. Keeping cells in the same flask for too long can lead to poor health and attachment ability.</li>
          <li style={s.li}>Media requirements vary per flask and line: T25 (~5mL); T75 (~15mL); T150 (~50mL).</li>
          <li style={{ ...s.li, color: red, fontWeight: 700 }}>Avoid splitting cells more than a 1:5 ratio to minimize clonal bottlenecking!</li>
        </ul>
        <ol style={s.ol}>
          <PLI>Check cells for health and confluency by examining them under the microscope.</PLI>
          <PLI>Spray media and TrypLE bottles with 70% EtOH and place in a bath at 37ºC for ~30 mins.</PLI>
          <PLI>Prepare BSC for cell culture as per section #2, and bring in the relevant supplies:
            <ol style={s.alpha}>
              <ALI>pipetman and falcon folder: EtOH spray, wipe and place into BSC</ALI>
              <ALI>flasks/plates and falcons: remove from bags outside the BSC and place directly into the BSC. Don't let the bags enter the BSC. Be sure the plates/flasks don't touch the non-sterile surfaces, such as the exterior of the plastic wrap</ALI>
              <ALI>sterile pipettes and aspirating pipets required for removing and dispensing media: wipe down wrappers with 70% EtOH sprayed kimwipes and place them in BSC.</ALI>
              <ALI>media once warm: EtOH spray, wipe, place in BSC, loosen cap.</ALI>
            </ol>
          </PLI>
          <PLI>Remove flasks/plates from the incubator and place in BSC. Work with one flask at a time. Place a flask vertically and loosen the cap.
            <ul style={s.circle}>
              <li style={s.li}>If expanding, remove the flask cap and use the pipette to remove the appropriate amount of media to obtain the required split. Then, place the media into a new flask pre-filled with the relevant amount of media. If you're new to cell culture, remove the media using the pipette and dispose of it in a Falcon or container. Discard pipettes in Hazardous Waste.</li>
              <li style={s.li}>If splitting, remove the flask cap and aliquot a portion of the cells into the bottom of a new flask pre-filled with the required amount of media. Tighten the cap and lay the flask horizontally, then move it gently in a cross-direction to distribute cells evenly across the flask. Finally, label the new flasks with initials, date, passage, and line/clone names.</li>
            </ul>
          </PLI>
          <PLI>Upon completion place all flasks in the incubator and clean the BSC.</PLI>
        </ol>
      </div>

      {/* 8. SUSPENSION CELLS */}
      <div ref={refSuspension} style={s.card}>
        <div style={s.h1}>8. Subculturing Suspension Cells - Cancer Lines</div>
        <ul style={s.ul}>
          <li style={s.li}>Work with one cell line at a time to limit cross-contamination</li>
          <li style={s.li}>Cells should be split before they reach ~80% of maximum density.</li>
          <li style={s.li}>Cells can remain in the same flask for ~30 days depending on the line. Keeping cells in the same flask for too long can lead to poor health.</li>
          <li style={s.li}>Media requirements vary per flask and line: T25 (~5mL); T75 (~15mL); T150 (~50mL).</li>
          <li style={{ ...s.li, color: red, fontWeight: 700 }}>Avoid splitting cells more than a 1:5 ratio to minimize clonal bottlenecking!</li>
        </ul>
        <ol style={s.ol}>
          <PLI>Check cells for health and confluency by examining them under the microscope.</PLI>
          <PLI>Spray media bottle(s) with 70% EtOH and place in a warming bath at 37ºC.</PLI>
          <PLI>Prepare BSC for cell culture as per section #2, and bring in the relevant supplies:
            <ol style={s.alpha}>
              <ALI>pipetman and falcon folder: EtOH spray, wipe and place into BSC</ALI>
              <ALI>flasks/plates and falcons: remove from bags outside the BSC and place directly into the BSC. Don't let the bags enter the BSC. Be sure the plates/flasks don't touch the non-sterile surfaces, such as the exterior of the plastic wrap</ALI>
              <ALI>sterile pipettes and aspirating pipets required for removing and dispensing media: wipe down wrappers with 70% EtOH sprayed kimwipes and place them in BSC.</ALI>
              <ALI>media once warm: EtOH spray, wipe, place in BSC, loosen cap.</ALI>
            </ol>
          </PLI>
          <PLI>Remove flasks/plates from the incubator and place in BSC. Work with one flask at a time. Place a flask vertically and loosen the cap.
            <ul style={s.circle}>
              <li style={s.li}>If expanding, remove the flask cap and use the pipette to remove the appropriate amount of media to obtain the required split. Then, place the media into a new flask pre-filled with the relevant amount of media. If you're new to cell culture, remove the media using the pipette and dispose of it in a Falcon or container. Discard pipettes in Hazardous Waste.</li>
              <li style={s.li}>If splitting, remove the flask cap and aliquot a portion of the cells into the bottom of a new flask pre-filled with the required amount of media. Tighten the cap and lay the flask horizontally, then move it gently in a cross-direction (see section 4) to distribute cells evenly across the flask. Finally, label the new flasks with initials, date, passage, and line/clone names.</li>
            </ul>
          </PLI>
          <PLI>Upon completion place all flasks in the incubator and clean the BSC.</PLI>
        </ol>
      </div>

      {/* 9. FREEZING CELLS */}
      <div ref={refFreezingCells} style={s.card}>
        <div style={s.h1}>9. Freezing Cells - Cancer Lines</div>
        <ul style={s.ul}>
          <li style={s.li}>The general recommendation is for cells not be stored in -80°C for longer than 3 months, at which point they should be moved to liquid nitrogen</li>
          <li style={s.li}>For cells to be moved to lab's liquid nitrogen storage, three things need to be in place:
            <ul style={s.circle}>
              <li style={s.li}>Cells need to be tested for mycoplasma and produce a negative result.</li>
              <li style={s.li}>Cells need to be correctly labeled (see below).</li>
              <li style={s.li}>Fill in the cell tracker draft sheet and send to Sarah alongside information on where your cells for liquid nitrogen can be found so that she can move them.</li>
            </ul>
          </li>
        </ul>
        <ol style={s.ol}>
          <PLI>Prepare BSC for use as per Section 2</PLI>
          <PLI>Disinfect the freezing media, and prewarm in the bath at 37°C for ~30mins</PLI>
          <PLI>Disinfect cryovial tube holders and bring to BSC</PLI>
          <PLI>Use Brady label maker to create labels for each cell line being frozen:
            <ol style={s.alpha}>
              <ALI>Cell line name</ALI>
              <ALI>Clone number or special condition - i.e. KO (if appropriate)</ALI>
              <ALI>Initials of person freezing</ALI>
              <ALI>2-letter initial of origin of cell line</ALI>
              <ALI>Date</ALI>
              <ALI>Passage number</ALI>
            </ol>
          </PLI>
          <PLI>Disinfect the vials and bring to BSC into the holder</PLI>
          <PLI>Count the cells and add the volume needed for 1×10⁶ cells/vial to be frozen into a new 50mL falcon while replating the remainder of cells if needed for later use</PLI>
          <PLI>Centrifuge cells (2min, 2000 RPM) for freezing, aspirate supernatant and resuspend the pellet in 1mL of freezing media / 1×10⁶ cells.</PLI>
          <PLI>Add 1mL of cells in freezing media to each vial to be frozen</PLI>
          <PLI>Store at -80°C</PLI>
        </ol>
      </div>

      {/* 10. COUNTING CELLS */}
      <div ref={refCounting} style={s.card}>
        <div style={s.h1}>10. Counting Cells (Demovix Cell Drop)</div>
        <p style={{ ...s.p, fontStyle: 'italic' }}>Protocol assumes that BSC has been set up and cells are being subcultured following the appropriate SOPs. Work with one cell line at a time.</p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <ul style={{ ...s.ul, flex: 1 }}>
            <li style={s.li}>Turn on Cell Drop.</li>
            <li style={s.li}>Disinfect 20uL pipettors and filtered tips, and bring into BSC.</li>
            <li style={s.li}>Take up 15ul of 70% ethanol (from a spray bottle) using a 20uL pipettor.</li>
            <li style={s.li}>Once asked to, place pipette tip on groove and dispense 15ul ethanol into measurement chamber of Cell Drop.
              <div style={{ marginTop: 8 }}>
                <img src="/tc-images/fig_9.jpg" alt="Pipette tip on Cell Drop" style={{ maxWidth: 180, borderRadius: 4, border: '1px solid var(--border)' }} />
              </div>
            </li>
            <li style={s.li}>Lift up the arm of Cell Drop and wipe the 'reading' area (both on machine and on arm) moving <strong>in one direction only</strong>.</li>
            <li style={s.li}>Put the arm back down and continue initiation.</li>
            <li style={s.li}>Collect one sterile microcentrifuge tube per cell line/clone that requires counting.</li>
            <li style={s.li}>Place in microcentrifuge tube holder and spray all with 70% ethanol, wipe down and place in BSC.</li>
            <li style={s.li}>Pipet cells gently up and down with 1mL pipet to eliminate settling.</li>
            <li style={s.li}>Remove 0.1 mL of cell suspension and place it in the microcentrifuge tube.</li>
            <li style={s.li}>Take 200 ul a pipettor and make sure the volume is set to 100 ul and get pipette tip.</li>
            <li style={s.li}>Obtain 100 ul of 0.4% trypan blue solution and add to microcentrifuge tube and mix by gently pipetting up and down.</li>
            <li style={s.li}>Take 20 ul pipettor and set to 10 ul and remove that volume from trypan blue/cell suspension.</li>
            <li style={s.li}>On Cell Drop choose Trypan blue button.</li>
            <li style={s.li}>Dispense cell suspension into the indentation of the measurement chamber.</li>
            <li style={s.li}>Adjust focus so unstained cells have bright white centers and sharp/clear boundaries.</li>
            <li style={s.li}>Once cells are no longer moving, tap the 'COUNT' button.</li>
            <li style={s.li}>Record total number of cells and total number of live cells. Live cell value should be much greater than dead cell value.</li>
            <li style={s.li}>When finished, lift the arm, wipe down both arm and machine sides of the measurement chamber in one direction only. If there is still debris, add 70% ethanol to a kimwipe and wipe again.</li>
          </ul>
        </div>
        <div style={{ marginTop: 12 }}>
          <img src="/tc-images/fig_2.jpg" alt="Figure 1: Correct focus and exposure settings" style={{ maxWidth: 220, borderRadius: 4, border: '1px solid var(--border)', display: 'block', marginBottom: 4 }} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, textAlign: 'center', maxWidth: 220 }}>Figure 1: Correct focus and exposure settings.</p>
        </div>
      </div>

      {/* 11. MYCOPLASMA TESTING */}
      <div ref={refMycoplasma} style={s.card}>
        <div style={s.h1}>11. Mycoplasma Testing</div>
        <ul style={s.ul}>
          <li style={s.li}>All new cells or mycoplasma positive lines are to be kept in a separate incubator (in 'quarantine').</li>
          <li style={s.li}>Media from cells to be tested should be in contact with cells for at least 2-3 days before collection. It can be collected and stored at 4ºC for up to a week or longer at -20ºC.</li>
        </ul>
        <ol style={s.ol}>
          <PLI>Use the MycoStrip mycoplasma detection kit.</PLI>
          <PLI>Warm up heatblock to 65ºC.</PLI>
          <PLI>Warm up sterile PBS-, Mycostrip reagents and appropriate number of detection strips to room temperature.</PLI>
          <PLI>Follow manufacturer's protocol: see below</PLI>
          <PLI>If cells are mycoplasma positive please report to Sarah so that the lab is aware and the cells will be either disposed of or, if essential, treated with Plasmocin or Plasmocure for 2 weeks and then retested.</PLI>
        </ol>

        {/* MycoStrip protocol sheets */}
        <p style={{ ...s.p, fontWeight: 700, color: 'var(--text-primary)', marginTop: 20 }}>MycoStrip™ Manufacturer Protocol</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          <img src="/tc-images/fig_1.jpg" alt="MycoStrip protocol page 1" style={{ maxWidth: '48%', minWidth: 280, borderRadius: 4, border: '1px solid var(--border)' }} />
          <img src="/tc-images/fig_4.jpg" alt="MycoStrip protocol page 2" style={{ maxWidth: '48%', minWidth: 280, borderRadius: 4, border: '1px solid var(--border)' }} />
        </div>
      </div>
    </div>
  );
}
