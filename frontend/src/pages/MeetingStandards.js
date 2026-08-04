import { useState } from 'react';

const s = {
  section: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'underline', background: '#FFF9C4', display: 'inline-block', margin: '0 0 14px', padding: '2px 8px', borderRadius: 3 },
  h3: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 6px' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  label: { fontSize: 11, fontWeight: 600, background: 'var(--purple-faint)', color: 'var(--purple-primary)', borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginBottom: 10 },
};

function LabMeetingGuidelines() {
  return (
    <div>
      <p style={s.p}>Our lab meetings are essential to the success of our team. They provide an opportunity for you to develop your presentation skills, which is crucial for any career you wish to pursue in science or beyond. Additionally, lab meetings are a critical opportunity for the team to learn about your project, brainstorm together, and provide the best input. <strong>To ensure the success of our lab meetings, we have the following guidelines:</strong></p>

      <div style={s.section}>
        <div style={s.h2}>1. TIMING</div>
        <p style={s.p}><strong>Please plan to go through your slides in ~50 minutes to allow for discussion. An alarm will go off 5 minutes before the end of the meeting,</strong> and meetings will strictly end after 1:30 hrs. We recommend that you practice your presentation beforehand until you become comfortable with the amount of content needed to complete the presentation in ~50 minutes. Lab meetings are given <strong>standing up</strong> to mimic the setting in conferences.</p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>2. FORMAT</div>
        <p style={s.p}>A successful 50-min presentation (assuming no interruptions) should be formatted as follows:</p>

        <p style={s.p}><u>Introduction (5–15 mins):</u> <strong>Provide relevant background by answering the following 4 questions:</strong></p>
        <ul style={s.ul}>
          <li style={s.li}>Why is what you are studying important?</li>
          <li style={s.li}>What is the existing data out there (or in the lab) relevant to your project?</li>
          <li style={s.li}>What are the gaps, i.e. what questions remain unaddressed?</li>
          <li style={s.li}>What are the specific questions you are addressing to close the gaps?</li>
        </ul>

        <p style={s.p}><u>Data (25–40 mins):</u> Show your progress on the project and get input on both general directions and specifics such as experimental designs. <strong>Organize the data into the questions you raised in the introduction, and ensure it is always clear which questions you are addressing when presenting experiments. This section also serves for you to get input over experiments and experimental designs that you are thinking about — please draw those out outlining as much detail as you can (model, assay, controls, conditions) so that we can effectively discuss.</strong></p>

        <p style={s.p}><u>Conclusions and next steps (~5 mins):</u> Summarize your conclusions and <strong>prioritize next steps while giving a rationale.</strong></p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>3. CLARITY</div>
        <p style={{ ...s.p, background: '#EAFAF1', border: '1px solid #A9DFBF', borderRadius: 6, padding: '10px 14px', color: 'var(--text-secondary)' }}>
          <strong>Successful presentations are those where everyone understands the relevance of your work and is able to follow your data. Because the presenter knows their research better than anyone and because no one else will have equivalent level of familiarity, it is the presenter's responsibility to make sure that everyone can follow the relevance and details. We achieve this by:</strong>
        </p>

        <p style={s.p}><u>Content:</u> The rule of thumb to make sure that everyone follows is less is more. Therefore, the figures or graphics that you will not be directly addressing are discouraged as they distract the audience.</p>

        <p style={s.p}><u>Figure descriptions:</u> The goal is for everyone to understand every figure that you are addressing. As a rule of thumb, expect no one to understand the data format or type you are showing — down to simple things like Western blots. The first key to success is that you understand the data yourself. This is particularly important when presenting data from published work. The second is communicating what the figure shows effectively. To achieve clarity over figure descriptions, we ask that you describe all of the below:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Model</strong> (e.g. lung cancer cell lines, prostate cancers following x treatment)</li>
          <li style={s.li}><strong>Assay</strong> (e.g. western blot, whole-genome sequencing, mRNA, FACS)</li>
          <li style={s.li}><strong>Data</strong> (e.g. for tables: each row is x, each column is y; for plots: x and y axes; for dotplots: what the dots are)</li>
        </ul>

        <p style={s.p}><u>Labelling:</u> Slides are expected to be clearly labelled. Clear labelling includes:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Informative slide titles</strong> — use a single statement summarizing the message of the slide. Titles are most informative when they serve as a conclusion (e.g. "Upregulation of BRCA1 Gene in Triple-Negative Breast Cancer Patients" rather than "Gene Expression Analysis").</li>
          <li style={s.li}><strong>Titles on all plots</strong> (recommended: assay and model, e.g. "APOBEC3A expression in prostate cancer cell lines")</li>
          <li style={s.li}><strong>Clearly labelled axes</strong> (and understanding of them) on all plots</li>
          <li style={s.li}><strong>Labelling legends and other features</strong> relevant for the group to understand the presented data</li>
        </ul>

        <p style={s.p}><u>Abbreviations:</u> <strong>The use of abbreviations is mostly discouraged</strong>, and where those are used they should be defined upfront. If non-standard, abbreviations should be written out in full at every instance in text on the slides as a reminder.</p>
      </div>
    </div>
  );
}

function JournalClubGuidelines() {
  return (
    <div>
      <p style={s.p}>The purpose of journal clubs is to stay in the loop with the field. Papers are agreed upon depending on their relevance to ongoing research in the lab. <strong>The expectation is that everyone reads the paper beforehand to be able to effectively participate in the discussion.</strong> Presentations can be done sitting or standing, to the presenter's preference.</p>

      <div style={s.section}>
        <div style={s.h2}>1. TIMING</div>
        <p style={s.p}>Journal clubs are <strong>1 hr long</strong> and involve a lot of discussion. Please aim to go through your slides in <strong>~35–40 minutes</strong> (assuming no interruptions) to enable discussion. An alarm will go off 5 minutes before the end of the meeting.</p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>2. FORMAT</div>
        <p style={s.p}>For a successful 35–40 min presentation:</p>
        <p style={s.p}><u>Introduction (~5 mins):</u> The background to the paper and what questions it was set out to address (as per the title and introduction of the paper).</p>
        <p style={s.p}><u>Data (~25–30 mins):</u> The goal is to do a deep dive into the data and <strong>critically</strong> assess the quality of the data and conclusions, with a focus on those data pieces relevant to the lab's and/or your own research. This will most often require you to go, understand, and present parts of the supplementary data.</p>
        <p style={s.p}><u>Conclusions (~5 mins):</u> <strong>The purpose is to contrast the conclusions of the paper with your own conclusions.</strong> I.e. are you convinced that the paper really shows what it states to be showing? If not, what are the remaining questions (e.g. suboptimal readout/experimental design; conclusions you disagree with)?</p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>3. CLARITY</div>
        <p style={s.p}>While slides do not need to be as polished as for lab meetings (everyone is expected to have read the paper), the group still need to be able to follow. Clearly describe (by labelling or verbally) what you are showing.</p>
        <p style={s.p}><strong><u>Further, you are not expected to talk about all the data in the paper — focus on those pieces relevant to yours or the lab's research are encouraged (less is more!)</u></strong></p>
      </div>
    </div>
  );
}

const SUBS = [
  { id: 'lab_meeting', label: 'Lab Meeting Guidelines' },
  { id: 'journal_club', label: 'Journal Club Guidelines' },
];

export default function MeetingStandards() {
  const [sub, setSub] = useState('lab_meeting');

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 24px' }}>Guidelines for lab meetings and journal clubs</p>

      <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 28, width: 'fit-content' }}>
        {SUBS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{
            padding: '10px 20px', border: 'none',
            background: sub === t.id ? 'var(--purple-primary)' : 'transparent',
            fontSize: 13, fontWeight: sub === t.id ? 600 : 400,
            color: sub === t.id ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'lab_meeting' ? <LabMeetingGuidelines /> : <JournalClubGuidelines />}
    </div>
  );
}
