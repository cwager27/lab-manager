import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const s = {
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  sub: { paddingLeft: 16, margin: '4px 0 8px' },
  note: { fontSize: 12, background: '#FEF9E7', border: '1px solid #FAD7A0', borderRadius: 6, padding: '8px 12px', color: '#B7770D', margin: '8px 0' },
  warn: { fontSize: 12, background: '#FDEDEC', border: '1px solid #F5B7B1', borderRadius: 6, padding: '8px 12px', color: '#C0392B', margin: '8px 0' },
  sub2: { paddingLeft: 32, margin: '4px 0 8px' },
};

const SECTIONS = [
  { id: 'general_rules', title: 'General Rules', content: GeneralRules },
  { id: 'bsc', title: '1. BioSafety Cabinet (BSC) Use', content: BSCUse },
  { id: 'media_prep', title: '2. Media Preparation — Cancer Lines', content: MediaPrep },
  { id: 'freezing_media', title: '3. Freezing Media Recipe — Cancer Lines', content: FreezingMedia },
  { id: 'conditioned_media', title: '4. Conditioned Media Preparation', content: ConditionedMedia },
  { id: 'thawing', title: '5. Thawing Cells — Cancer Lines', content: ThawingCells },
  { id: 'adherent', title: '6. Maintaining Adherent Cells', content: AdherentCells },
  { id: 'suspension', title: '7. Subculturing Suspension Cells', content: SuspensionCells },
  { id: 'freezing_cells', title: '8. Freezing Cells — Cancer Lines', content: FreezingCells },
  { id: 'counting', title: '9. Counting Cells (Demovix Cell Drop)', content: CountingCells },
  { id: 'mycoplasma', title: '10. Mycoplasma Testing', content: MycoplasmaTest },
];


function GeneralRules() {
  return (
    <div>
      <p style={{ ...s.p, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Rules applicable whenever working in the TC room:</p>

      {[
        {
          title: 'Disposable Lab Coats',
          items: [
            'Should be put on immediately when entering the TC room and worn at all times.',
            'Should never be used outside of the TC room.',
            'Should be replaced with a new coat and labeled each week.',
          ],
        },
        {
          title: 'Gloves',
          items: [
            'Should be put on and disinfected with 70% ethanol immediately upon entering the TC room.',
            'Nothing can be touched in the TC room before the gloves are worn and disinfected.',
            'If bringing in labware from outside the TC, replace gloves when entering the room.',
          ],
        },
        {
          title: 'TC Equipment',
          items: [
            'Any reagents, supplies, or equipment brought to the TC should be 70% ethanol cleaned.',
            'The TC room has designated pipette controllers and serological pipettes. The pipette controllers are currently charged in the main lab in the bay by the microwave. Bring them into the TC room with gloves on, spray with 70% ethanol, replace gloves, and respray new gloves.',
            'The TC room has designated tube racks, markers, and other supplies that should not leave the room or be used for anything non-TC related.',
          ],
        },
        {
          title: 'Reagents and Supplies',
          items: [
            'Use of autoclaved/recycled supplies in TC is strictly forbidden.',
            'Each user has their own labelled media and TrypLE for cell culture.',
            'Sterile, individually wrapped pipettes and aspirators are used for cell culture.',
            'Only filtered tips are used for cell culture. Use of non-filtered tips is banned in BSC.',
            'Cleaning supplies: 70% ethanol, 10% bleach, and detergent and distilled water (both using autoclaved, distilled water).',
            'If you notice low stocks of anything please tell Sarah.',
          ],
        },
        {
          title: 'Warming Bath',
          items: ['Anything going in has to be cleaned with 70% ethanol first.'],
        },
        {
          title: 'Biosafety Cabinet (BSC) Use',
          items: [
            'Anything entering BSC has to be cleaned with 70% ethanol first.',
            'Disinfect your gloves every time they enter the BSC, even if your hands were out only shortly.',
            'BSCs have to be cleaned before and after use as per the instructions in this document.',
            'VacTrap is to be emptied whenever waste reaches levels designated on the VacTrap, as well as by the last user every Friday regardless of level in container.',
            'BSC needs to be closed by the last user every day.',
          ],
        },
      ].map(g => (
        <div key={g.title} style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{g.title}</p>
          <ul style={s.ul}>
            {g.items.map((item, i) => <li key={i} style={s.li}>{item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BSCUse() {
  return (
    <div>
      <div style={s.note}>NYU policy is explicit that UV lights may not be used in BSC — do not turn it on.</div>
      <ul style={s.ul}>
        <li style={s.li}>Raise the BSC sash to the correct level (evident by a mark or an alarm that ceases at the correct height) and run the fan for <strong>20 minutes</strong> before use.</li>
        <li style={s.li}>Check that the VacTrap top is tightly screwed on the bottle, turn on and confirm suction.</li>
        <li style={s.li}><strong>Clean the BSC interior before use</strong> (if opening BSC, clean after 15 minutes of fan running and leave for 5 mins to dry):
          <ul style={{ ...s.ul, ...s.sub }}>
            <li style={s.li}><em>If visible stains (e.g. dried media):</em> first wipe with detergent pre-prepared with autoclaved water, then wipe with 10% bleach, then 70% ethanol (EtOH).</li>
            <li style={s.li}><em>If no stains:</em> wipe with 10% bleach, then 70% EtOH.</li>
          </ul>
        </li>
        <li style={s.li}><strong>All reagents, supplies, and your gloves need to be disinfected before entering the BSC:</strong>
          <ul style={{ ...s.ul, ...s.sub }}>
            <li style={s.li}>Gloves: spray with 70% EtOH every time your hands enter the BSC (even if they were out for a short period).</li>
            <li style={s.li}>Anything plastic/impervious to liquid (no exposed paper/filters): spray with 70% EtOH.</li>
            <li style={s.li}>Wrappers from serological and aspirating pipettes: wipe with 70% EtOH-sprayed kimwipes.</li>
            <li style={s.li}><strong>Exception:</strong> do not spray or wipe down flasks or plates taken from incubators that are currently holding cells — to prevent sloshing, lifting of plate top, wetting of flask-top filter, and contamination.</li>
          </ul>
        </li>
        <li style={s.li}>Clean the BSC at the end of use (same steps as above).</li>
        <li style={s.li}>Turn off the fan unless another individual is going to use the BSC.</li>
        <li style={s.li}><strong>VacTrap waste:</strong> If waste is at or above the first marked line (50% full), remove it and bring to the sink. Add bleach equal to 10% of the total volume, swirl to mix, dump the liquid down the sink, and rinse out the bottle. Add enough Bacdown Disinfectant soap to cover the bottom. Place the VacTrap back under the BSC with the lid loose to allow water to evaporate.</li>
      </ul>
    </div>
  );
}

function MediaPrep() {
  return (
    <div>
      <ul style={s.ul}>
        <li style={s.li}>Bring media (DMEM:F12 or RPMI; stored at 4°C), FBS and pen/strep aliquots (both -20°C) to the TC, spray with 70% EtOH, and place in a warming bath at 37°C. <em>Note: If only preparing media and not using it immediately, you do not need to prewarm — you only need to thaw the supplements.</em></li>
        <li style={s.li}>Once aliquots are thawed, spray them and a media bottle with 70% EtOH, wipe, and place in the BSC.</li>
        <li style={s.li}>Bring serological pipettes and pipettor, disinfect with 70% EtOH, wipe and place in BSC.</li>
        <li style={s.li}>Unscrew caps/lids from all bottles (media, supplements) but leave them on.</li>
        <li style={s.li}>Add supplements to the media. Both RPMI and DMEM:F12 require:
          <ul style={{ ...s.ul, ...s.sub }}>
            <li style={s.li}><strong>10% FBS</strong> — add 50 mL aliquot directly to the bottle using pipette.</li>
            <li style={s.li}><strong>1× PenStrep</strong> — add 5 mL aliquot directly to the bottle.</li>
          </ul>
        </li>
        <li style={s.li}>Clearly mark on the bottle: your initials, date, 10% FBS, 1× pen/strep, and any other supplements/reagents added.</li>
        <li style={s.li}>Once done with TC work, store the media at 4°C for later use.</li>
      </ul>
    </div>
  );
}

function FreezingMedia() {
  return (
    <div>
      <ul style={s.ul}>
        <li style={s.li}><strong>Fetal bovine serum (FBS) or other serum:</strong> 20%</li>
        <li style={s.li}><strong>Dimethyl sulfoxide (DMSO):</strong> 10%</li>
        <li style={s.li}><strong>RPMI or DMEM media:</strong> 70%</li>
      </ul>
    </div>
  );
}

function ConditionedMedia() {
  return (
    <div>
      <p style={s.p}>The length of time for cells to create conditioned media is dependent on cell type. The general recommendation is that fresh media is added to ~50–60% confluent/dense lines and left for 1–2 days (until turns orange but not yellow) before collecting and preparing.</p>
      <ul style={s.ul}>
        <li style={s.li}>Set up BSC for use as per Section 1.</li>
        <li style={s.li}>Bring cell lines that were a priori incubated at ~50–60% confluency for ~2 days to BSC.</li>
        <li style={s.li}>Collect media from lines into 50 mL falcons, and add fresh media to the lines — return cell lines to the incubator.</li>
        <li style={s.li}>Spin the collected media for approximately 2 minutes at 2000 RPM.</li>
        <li style={s.li}>Disinfect the falcons and bring them back to BSC carefully so as not to disturb the cell pellet.</li>
        <li style={s.li}>Collect the media from the falcon into a new one, carefully not disturbing the pellet, leaving ~1 mL of media behind.</li>
        <li style={s.li}>Repeat the spinning and collection process into a new falcon, leaving ~1 mL media behind.</li>
        <li style={s.li}>Filter media through appropriate filters depending on the sizes of the proteins you wish to collect. For general conditioned media collected to enhance/help the growth of the lines: Corning low-protein binding filters are recommended.</li>
        <li style={s.li}>Label with initials, date of collection, name of the line from which collected.</li>
        <li style={s.li}>The collected media can be stored at 4°C. <strong>Do NOT store at -20°C.</strong></li>
      </ul>
    </div>
  );
}

function ThawingCells() {
  return (
    <div>
      <div style={s.note}>To request a cell line, contact Sarah. She maintains a lab record of all cell lines and will retrieve the requested cell line from liquid nitrogen and place it in the -80°C freezer.</div>
      <ul style={s.ul}>
        <li style={s.li}><strong>New lines</strong> (newly purchased or obtained from collaborators) must be placed in the designated isolation incubator until testing negative for mycoplasma. If positive, inform Sarah immediately.</li>
        <li style={s.li}>Bring complete media (see Section 2) to the TC, spray with 70% EtOH, wipe down, and place in a warming bath at 37°C. Leave for ~30 minutes.</li>
        <li style={s.li}>While the media is warming, prepare the BSC for use as described in Section 1.</li>
        <li style={s.li}>Prepare T25 flasks (one flask per vial of cells being thawed). Remove flasks from their bags just outside the BSC, and place them directly into the BSC. Do not allow the bags to enter the BSC.</li>
        <li style={s.li}>Prepare sterile pipettes, aspirating pipettes, and pipetman. Spray pipetman with 70% EtOH; wipe wrappers with 70% EtOH-sprayed kimwipe. Place in BSC.</li>
        <li style={s.li}>Spray the cryotube holder with 70% EtOH, wipe down, and place in BSC.</li>
        <li style={s.li}>Once media is warm, spray the media bottle with 70% EtOH, wipe and place in the BSC. Turn T25 flasks vertically, unscrew caps but leave them on. Add 5 mL of media to each flask using a 5 mL pipette.</li>
        <li style={s.li}>Bring cell vials into the TC, spray with 70% ethanol, wipe, and place in the warming bath to thaw. Monitor carefully — takes only 1–1.5 minutes. Remove as soon as fully thawed. <strong>Prolonged exposure to DMSO damages cells.</strong></li>
        <li style={s.li}>Spray vials with 70% EtOH, wipe them, and place into the vial holder in BSC.</li>
        <li style={s.li}><strong>Work with one cryovial at a time — never have &gt;1 cryovial open at the same time.</strong></li>
        <li style={s.li}>Open the cryovial and gently extract cells using a 1 mL sterile transfer pipette. Gently place the cell solution into the media in the T25 flask, screw on the cap, place horizontally, and move the flask in a cross pattern to distribute cells evenly. Label the flask with initials, date, cell line, and passage number.</li>
        <li style={s.li}>Once complete with all flasks, place them in the incubator and clean the BSC.</li>
        <li style={s.li}>Replace media with fresh media after 24 hours or once cells become adherent to remove residual DMSO. Transfer cells to larger flasks once confluent.</li>
      </ul>
    </div>
  );
}

function AdherentCells() {
  return (
    <div>
      <ul style={s.ul}>
        <li style={s.li}>Work with one cell line at a time to limit cross-contamination.</li>
        <li style={s.li}>Cells should be split when about <strong>80% confluent</strong>.</li>
        <li style={s.li}>Cells can remain in the same flask for ~30 days depending on the line. Keeping cells too long in the same flask can lead to poor health and attachment ability.</li>
        <li style={s.li}>Media requirements vary per flask: T25 (~5 mL); T75 (~15 mL); T150 (~50 mL).</li>
        <li style={s.li}><strong>Avoid splitting cells more than a 1:5 ratio to minimize clonal bottlenecking!</strong></li>
        <li style={s.li}>Check cells for health and confluency under the microscope.</li>
        <li style={s.li}>Spray media and TrypLE bottles with 70% EtOH and place in a bath at 37°C for ~30 mins.</li>
        <li style={s.li}>Prepare BSC as per Section 1. Bring in relevant supplies:
          <ul style={{ ...s.ul, ...s.sub }}>
            <li style={s.li}>Pipetman and falcon folder: EtOH spray, wipe and place into BSC.</li>
            <li style={s.li}>Flasks/plates and falcons: remove from bags outside the BSC and place directly into BSC.</li>
            <li style={s.li}>Sterile pipettes and aspirating pipettes: wipe down wrappers with 70% EtOH-sprayed kimwipes and place in BSC.</li>
            <li style={s.li}>Media and TrypLE once warm: EtOH spray, wipe, place in BSC, loosen caps.</li>
          </ul>
        </li>
        <li style={s.li}>Remove flasks/plates from the incubator and place in BSC. Work with one flask at a time. Place flask vertically and loosen the cap.</li>
        <li style={s.li}>Aspirate media from the bottom corner away from cells. Discard aspirating pipette in Hazardous Waste.</li>
        <li style={s.li}>Add TrypLE according to flask size (T25: 2 mL; T75: 5 mL; T150: 10 mL), tighten cap, place horizontally, and distribute TrypLE using a cross-motion. Incubate all flasks for ~5–20 mins, until most cells detach.</li>
        <li style={s.li}>Label new flasks with initials, date, cell line/clone, and passage number. Once cells detach, gently tap the side of the flask horizontally to loosen any remaining adherent cells. Add appropriate volume of media with a fresh pipette to collect remaining cells.</li>
        <li style={s.li}>If expanding the cell line, aliquot a portion into the bottom of a new flask pre-filled with the required amount of media. Move gently in a cross-direction to distribute cells evenly. Alternatively, dispose of the portion into a Falcon tube/container.</li>
        <li style={s.li}>Upon completion, place all flasks in the incubator and clean the BSC.</li>
      </ul>
    </div>
  );
}

function SuspensionCells() {
  return (
    <div>
      <ul style={s.ul}>
        <li style={s.li}>Work with one cell line at a time to limit cross-contamination.</li>
        <li style={s.li}>Cells should be split before they reach ~80% of maximum density.</li>
        <li style={s.li}>Cells can remain in the same flask for ~30 days depending on the line.</li>
        <li style={s.li}>Media requirements: T25 (~5 mL); T75 (~15 mL); T150 (~50 mL).</li>
        <li style={s.li}><strong>Avoid splitting cells more than a 1:5 ratio to minimize clonal bottlenecking!</strong></li>
        <li style={s.li}>Check cells for health and confluency under the microscope.</li>
        <li style={s.li}>Spray media bottle(s) with 70% EtOH and place in a warming bath.</li>
        <li style={s.li}>Prepare BSC as per Section 1. Bring in relevant supplies (same as adherent cells, minus TrypLE).</li>
        <li style={s.li}>Remove flasks/plates from the incubator and place in BSC. Work with one flask at a time. Place flask vertically and loosen the cap.</li>
        <li style={s.li}><strong>If expanding:</strong> use pipette to remove the appropriate amount of media to obtain the required split, then place into a new flask pre-filled with the relevant amount of media.</li>
        <li style={s.li}><strong>If splitting:</strong> aliquot a portion of the cells into the bottom of a new flask pre-filled with the required amount of media. Tighten cap, lay horizontally, and move gently in a cross-direction to distribute cells evenly. Label the new flasks with initials, date, passage, and line/clone names.</li>
        <li style={s.li}>Upon completion, place all flasks in the incubator and clean the BSC.</li>
      </ul>
    </div>
  );
}

function FreezingCells() {
  return (
    <div>
      <div style={s.note}>The general recommendation is for cells not to be stored in -80°C for longer than 3 months, at which point they should be moved to liquid nitrogen.</div>
      <p style={s.p}>For cells to be moved to the lab's liquid nitrogen storage, three things need to be in place:</p>
      <ul style={s.ul}>
        <li style={s.li}>Cells need to be tested for mycoplasma and produce a negative result.</li>
        <li style={s.li}>Cells need to be correctly labeled (see below).</li>
        <li style={s.li}>Fill in the cell tracker draft sheet and send to Sarah alongside information on where your cells for liquid nitrogen can be found.</li>
      </ul>
      <p style={{ ...s.p, marginTop: 12, fontWeight: 600 }}>Protocol:</p>
      <ul style={s.ul}>
        <li style={s.li}>Prepare BSC for use as per Section 1.</li>
        <li style={s.li}>Disinfect the freezing media and prewarm in the bath at 37°C for ~30 mins.</li>
        <li style={s.li}>Disinfect cryovial tube holders and bring to BSC.</li>
        <li style={s.li}>Use Brady label maker to create labels for each cell line. Labels must include:
          <ul style={{ ...s.ul, ...s.sub }}>
            <li style={s.li}>Cell line name</li>
            <li style={s.li}>Clone number or special condition (e.g. KO) if appropriate</li>
            <li style={s.li}>Initials of person freezing</li>
            <li style={s.li}>2-letter initial of origin of cell line</li>
            <li style={s.li}>Date</li>
            <li style={s.li}>Passage number</li>
          </ul>
        </li>
        <li style={s.li}>Disinfect the vials and bring to BSC in the holder.</li>
        <li style={s.li}>Count the cells and add the volume needed for 1×10⁶ cells/vial to be frozen into a new 50 mL falcon while replating the remainder if needed.</li>
        <li style={s.li}>Centrifuge cells (2 min, 2000 RPM), aspirate supernatant, and resuspend the pellet in 1 mL of freezing media / 1×10⁶ cells.</li>
        <li style={s.li}>Add 1 mL of cells in freezing media to each vial to be frozen.</li>
        <li style={s.li}>Store at -80°C.</li>
      </ul>
    </div>
  );
}

function CountingCells() {
  return (
    <div>
      <div style={s.note}>Protocol assumes that BSC has been set up and cells are being subcultured following the appropriate SOPs. Work with one cell line at a time.</div>
      <ul style={s.ul}>
        <li style={s.li}>Turn on Cell Drop.</li>
        <li style={s.li}>Disinfect 20 µL pipettors and filtered tips, and bring into BSC.</li>
        <li style={s.li}>Take up 15 µL of 70% ethanol (from a spray bottle) using a 20 µL pipettor.</li>
        <li style={s.li}>Place pipette tip on groove and dispense 15 µL ethanol into measurement chamber of Cell Drop.</li>
        <li style={s.li}>Lift up the arm of Cell Drop and wipe the 'reading' area (both on machine and on arm) moving in <strong>one direction only</strong>.</li>
        <li style={s.li}>Put the arm back down and continue initiation.</li>
        <li style={s.li}>Collect one sterile microcentrifuge tube per cell line/clone. Spray all with 70% ethanol, wipe down, and place in BSC.</li>
        <li style={s.li}>Pipette cells gently up and down with 1 mL pipet to eliminate settling.</li>
        <li style={s.li}>Remove 0.1 mL of cell suspension and place it in the microcentrifuge tube.</li>
        <li style={s.li}>Set pipettor to 100 µL. Obtain 100 µL of 0.4% trypan blue solution, add to microcentrifuge tube, and mix by gently pipetting up and down.</li>
        <li style={s.li}>Set 20 µL pipettor to 10 µL. Remove that volume from trypan blue/cell suspension.</li>
        <li style={s.li}>On Cell Drop, choose "Trypan blue" button.</li>
        <li style={s.li}>Dispense cell suspension into the indentation of the measurement chamber.</li>
        <li style={s.li}>Adjust focus so unstained cells have bright white centers and sharp/clear boundaries.</li>
        <li style={s.li}>Once cells are no longer moving, tap the 'COUNT' button.</li>
        <li style={s.li}>Record total number of cells and total number of live cells. <strong>Live cell value should be much greater than dead cell value.</strong></li>
        <li style={s.li}>When finished, lift the arm, wipe down both arm and machine sides of the measurement chamber in one direction only. If there is still debris, add 70% ethanol to a kimwipe and wipe again.</li>
      </ul>
    </div>
  );
}

function MycoplasmaTest() {
  return (
    <div>
      <div style={s.warn}>All new cells or mycoplasma positive lines are to be kept in a separate incubator (in 'quarantine').</div>
      <ul style={s.ul}>
        <li style={s.li}>Media from cells to be tested should be in contact with cells for at least <strong>2–3 days</strong> before collection. It can be collected and stored at 4°C for up to a week or longer at -20°C.</li>
        <li style={s.li}>Use the <strong>MycoStrip mycoplasma detection kit</strong>.</li>
        <li style={s.li}>Warm up heat block to 65°C.</li>
        <li style={s.li}>Warm up sterile PBS⁻, Mycostrip reagents, and appropriate number of detection strips to room temperature.</li>
        <li style={s.li}>Follow manufacturer's protocol.</li>
        <li style={s.li}><strong>If cells are mycoplasma positive:</strong> please report to Sarah immediately so that the lab is aware. Cells will be either disposed of or, if essential, treated with Plasmocin or Plasmocure for 2 weeks and then retested.</li>
      </ul>
    </div>
  );
}

export default function TissueCultureSOP() {
  const [allOpen, setAllOpen] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Tissue Culture SOP</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Updated December 2025 — Click a section to expand</p>
        </div>
        <button onClick={() => setAllOpen(o => !o)} style={{ fontSize: 12, color: 'var(--purple-primary)', background: 'var(--purple-faint)', border: '1px solid var(--purple-border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      {SECTIONS.map(sec => (
        <CollapsibleSection key={sec.id} sec={sec} forceOpen={allOpen} />
      ))}
    </div>
  );
}

function CollapsibleSection({ sec, forceOpen }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const Content = sec.content;
  return (
    <div style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: isOpen ? 'var(--purple-faint)' : 'var(--bg-card)',
        border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        {isOpen ? <ChevronDown size={15} color="var(--purple-primary)" /> : <ChevronRight size={15} color="var(--text-muted)" />}
        <span style={{ fontSize: 14, fontWeight: isOpen ? 700 : 500, color: isOpen ? 'var(--purple-primary)' : 'var(--text-primary)' }}>{sec.title}</span>
      </button>
      {isOpen && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <Content />
        </div>
      )}
    </div>
  );
}
