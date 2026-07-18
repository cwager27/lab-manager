import { useState } from 'react';

const s = {
  section: { marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  h2: { fontSize: 13, fontWeight: 700, color: 'var(--purple-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px', paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  h3: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 6px' },
  p: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 8px' },
  li: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 4 },
  ul: { paddingLeft: 20, margin: '0 0 8px' },
  label: { fontSize: 11, fontWeight: 600, background: 'var(--purple-faint)', color: 'var(--purple-primary)', borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginBottom: 10 },
};

function LabMeetingGuidelines() {
  return (
    <div>
      <p style={s.p}>Our lab meetings are essential to the success of our team. They provide an opportunity for you to develop your presentation skills, which is crucial for any career you wish to pursue in science or beyond. Additionally, lab meetings are a critical opportunity for the team to learn about your project, brainstorm together, and provide the best input.</p>

      <div style={s.section}>
        <div style={s.h2}>1. Timing</div>
        <p style={s.p}>Lab meetings are <strong>1 hr 30 mins</strong> long and involve extensive discussion. Please plan to go through your slides in <strong>~50 minutes</strong> to allow for discussion. An alarm will go off 5 minutes before the end of the meeting, and meetings will strictly end after 1:30 hrs.</p>
        <p style={s.p}>We recommend that you practice your presentation beforehand. Lab meetings are given <strong>standing up</strong> to mimic the setting in conferences.</p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>2. Format</div>
        <p style={s.p}>A successful 50-min presentation (assuming no interruptions) should be formatted as follows:</p>
        <div style={s.h3}>Introduction (5–15 mins)</div>
        <p style={s.p}>Provide relevant background by answering the following 4 questions:</p>
        <ul style={s.ul}>
          <li style={s.li}>Why is what you are studying important?</li>
          <li style={s.li}>What is the existing data out there (or in the lab) relevant to your project?</li>
          <li style={s.li}>What are the gaps, i.e. what questions remain unaddressed?</li>
          <li style={s.li}>What are the specific questions you are addressing to close the gaps?</li>
        </ul>
        <div style={s.h3}>Data (25–40 mins)</div>
        <p style={s.p}>Show your progress on the project and get input on both general directions and specifics such as experimental designs. Organize the data into the questions you raised in the introduction, and ensure it is always clear which questions you are addressing when presenting experiments. This section also serves for you to get input over experiments and experimental designs that you are thinking about — please draw those out outlining as much detail as you can (model, assay, controls, conditions).</p>
        <div style={s.h3}>Conclusions and next steps (~5 mins)</div>
        <p style={s.p}>Summarize your conclusions and prioritize next steps while giving a rationale.</p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>3. Clarity</div>
        <p style={s.p}>Successful presentations are those where everyone understands the relevance of your work and is able to follow your data. Because the presenter knows their research better than anyone, it is the presenter's responsibility to make sure that everyone can follow the relevance and details.</p>

        <div style={s.h3}>Content</div>
        <p style={s.p}>Less is more. Figures or graphics that you will not be directly addressing are discouraged as they distract the audience.</p>

        <div style={s.h3}>Figure Descriptions</div>
        <p style={s.p}>The goal is for everyone to understand every figure. Expect no one to understand the data format or type you are showing — down to simple things like Western blots. Describe all of the following:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Model</strong> (e.g. lung cancer cell lines, prostate cancers following x treatment)</li>
          <li style={s.li}><strong>Assay</strong> (e.g. western blot, whole-genome sequencing, mRNA, FACS)</li>
          <li style={s.li}><strong>Data</strong> (e.g. for tables: each row is x, each column is y; for plots: x and y axes; for dotplots: what the dots are)</li>
        </ul>

        <div style={s.h3}>Labelling</div>
        <p style={s.p}>Slides are expected to be clearly labelled. Clear labelling includes:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong>Informative slide titles</strong> — use a single statement summarizing the message of the slide. Titles are most informative when they serve as a conclusion (e.g. "Upregulation of BRCA1 Gene in Triple-Negative Breast Cancer Patients" rather than "Gene Expression Analysis").</li>
          <li style={s.li}><strong>Titles on all plots</strong> (recommended: assay and model, e.g. "APOBEC3A expression in prostate cancer cell lines")</li>
          <li style={s.li}>Clearly labelled axes on all plots</li>
          <li style={s.li}>Labelled legends and other features relevant for the group</li>
        </ul>

        <div style={s.h3}>Abbreviations</div>
        <p style={s.p}>The use of abbreviations is mostly discouraged. Where used, they should be defined upfront and where possible written out in full on slides as a reminder.</p>
      </div>
    </div>
  );
}

function JournalClubGuidelines() {
  return (
    <div>
      <p style={s.p}>The purpose of journal clubs is to stay in the loop with the field. Papers are agreed upon depending on their relevance to ongoing research in the lab. Everyone is expected to read the paper beforehand to be able to effectively participate in the discussion. Presentations can be done sitting or standing, to the presenter's preference.</p>

      <div style={s.section}>
        <div style={s.h2}>1. Timing</div>
        <p style={s.p}>Journal clubs are <strong>1 hr long</strong> and involve a lot of discussion. Please aim to go through your slides in <strong>~35–40 minutes</strong> (assuming no interruptions) to enable discussion. An alarm will go off 5 minutes before the end of the meeting.</p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>2. Format</div>
        <p style={s.p}>For a successful 35–40 min presentation:</p>
        <div style={s.h3}>Introduction (~5 mins)</div>
        <p style={s.p}>The background to the paper and what questions it was set out to address (as per the title and introduction of the paper).</p>
        <div style={s.h3}>Data (~25–30 mins)</div>
        <p style={s.p}>Do a deep dive into the data and critically assess the quality of the data and conclusions, with a focus on those data pieces relevant to the lab's and/or your own research. This will most often require you to go, understand, and present parts of the supplementary data.</p>
        <div style={s.h3}>Conclusions (~5 mins)</div>
        <p style={s.p}>Contrast the conclusions of the paper with your own conclusions: Are you convinced that the paper really shows what it states to be showing? If not, what are the remaining questions (e.g. suboptimal readout/experimental design; conclusions you disagree with)?</p>
      </div>

      <div style={s.section}>
        <div style={s.h2}>3. Clarity</div>
        <p style={s.p}>While slides do not need to be as polished as for lab meetings (everyone is expected to have read the paper), the group still need to be able to follow. Clearly describe (by labelling or verbally) what you are showing.</p>
        <p style={s.p}>Focus on data pieces relevant to yours or the lab's research — less is more!</p>
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
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Lab Meetings Standards</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 24px' }}>Guidelines for lab meetings and journal clubs</p>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 28 }}>
        {SUBS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{
            padding: '8px 20px', border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: sub === t.id ? 700 : 400,
            color: sub === t.id ? 'var(--purple-primary)' : 'var(--text-secondary)',
            borderBottom: sub === t.id ? '2px solid var(--purple-primary)' : '2px solid transparent',
            marginBottom: -2, cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'lab_meeting' ? <LabMeetingGuidelines /> : <JournalClubGuidelines />}
    </div>
  );
}
