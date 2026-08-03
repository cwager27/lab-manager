-- Seed: Mutational Signatures - Standard Analysis Outline
-- Source: Petljak Lab internal documentation
-- Safe to run multiple times — each INSERT skips if the title already exists.

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Mutation signatures: terminology and mutation types',
  'Standard definitions used across mutational signature analysis in the lab.

Single base substitutions (SBS): mutations consisting of a single base change, e.g. a C→T transition in a TCA trinucleotide context. Also known as SNVs, or SNPs in the germline context.

Indels (IDs): mutations consisting of insertions or deletions of DNA, under 50 bp in size.

Structural variations (SVs): large duplications, insertions, deletions, or structural rearrangements (inversions, translocations) — larger than indels.

Copy number variants (CNVs): a subset of SVs involving large duplications or deletions of DNA.

Mutational burden units:
- SBS, ID, SV: counted as number of variants per sample (discrete events). For single-molecule sequencing (e.g. NanoSeq), burden must be expressed as mutations per (mega)base or per diploid cell to correct for sequencing depth — see Abascal 2021.
- CNV: burden is not a solved problem; common metrics include fraction genome altered (FGA), CNV segment count, and CNV segment sizes.',
  NULL, 'bash', 'Bioinformatics',
  'mutation signatures, SBS, indels, SVs, CNVs, terminology, NanoSeq, SNV',
  'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: terminology and mutation types');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Mutation signatures: standard analysis workflow overview',
  'The standard mutational signature analysis follows six sequential steps. Each step has required figures.

Step 1 — Mutational burden overview
Step 2 — Mutational spectra overview
Step 3 — De novo signature extraction and selection
Step 4 — Signature decomposition into reference signatures
Step 5 — Per-sample signature breakdown (stacked bar plots)
Step 6 — Per-signature comparisons across groups (boxplots)

Each step is described in detail in the corresponding tips. Tools used: SigProfilerExtractor (de novo extraction), SigProfilerAssignment (decomposition).',
  NULL, 'bash', 'Bioinformatics',
  'mutation signatures, workflow, analysis outline, SigProfilerExtractor, SigProfilerAssignment',
  'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: standard analysis workflow overview');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Mutation signatures: visualizing mutational burden (Step 1)',
  'Required figures for summarizing mutational burden across samples.

For SBS, ID, and SV (discrete events):
- In WGS or WES, mutational burden is invariant to sequencing depth — report as total number of events per sample.
- Figure 1a: barplot — mutational burden (y-axis) per sample (x-axis).
- Figure 1b: boxplot — mutational burden (y-axis) per experimental group / dependent variable (x-axis).
- For single-molecule sequencing: correct for sequencing coverage (e.g. duplex recovery) and express as mutations per (mega)base or per diploid cell.

For CNVs (no standard metric):
Choose one of the following to summarize chromosomal instability (CIN), and use it consistently:
- Fraction genome altered (FGA): fraction of genome that is non-diploid.
- CNV segment count: total number of distinct copy number segments.
- CNV segment sizes: distribution of segment lengths.
Present the chosen metric using the same barplot + boxplot format as above.',
  NULL, 'bash', 'Bioinformatics',
  'mutation signatures, mutational burden, barplot, boxplot, CNV, CIN, FGA, NanoSeq, visualization',
  'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: visualizing mutational burden (Step 1)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Mutation signatures: mutational spectra overview (Step 2)',
  'Required figure: the total mutational spectrum for each biological sample.

For whichever channel paradigm is used (SBS 96-channel, ID 83- or 89-channel, SV, CNV, etc.), produce a figure showing the complete mutational spectrum per sample.

Layout convention:
- Rows = samples
- Columns = dependent variables (experimental groupings)

Ensure that samples are presented in a logical order that makes comparisons across conditions clear. This figure gives reviewers and collaborators an intuitive view of the raw mutation patterns before any signature decomposition is applied.',
  NULL, 'bash', 'Bioinformatics',
  'mutation signatures, mutational spectra, SBS, 96-channel, ID, 83-channel, visualization',
  'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: mutational spectra overview (Step 2)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Mutation signatures: de novo extraction and signature selection (Step 3)',
  'Tool: SigProfilerExtractor (https://github.com/AlexandrovLab/SigProfilerExtractor)

Run de novo signature extraction. SigProfilerExtractor automatically produces a figure for signature count selection. This figure shows:
- X-axis: number of signatures extracted
- Y-axis: signature stability metrics (mean sample stability, sample cosine distance, etc.)

Required figure: include the SigProfilerExtractor stability plot in the analysis.

Required text: accompany the figure with a brief explanation of which signature solution was selected and why (e.g. "We selected the N-signature solution because it maximised mean sample stability while the N+1 solution introduced an unstable signature with cosine similarity > 0.95 to an existing one").',
  NULL, 'bash', 'Bioinformatics',
  'mutation signatures, de novo extraction, SigProfilerExtractor, signature selection, stability, cosine distance',
  'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: de novo extraction and signature selection (Step 3)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Mutation signatures: decomposition into reference signatures (Step 4)',
  'Tool: SigProfilerAssignment (https://github.com/AlexandrovLab/SigProfilerAssignment)

After de novo extraction, decompose each de novo signature into COSMIC reference mutational signatures.

Required figures (from SigProfilerAssignment output): for each de novo signature, show:
1. The de novo signature spectrum
2. Its decomposition into reference signatures (side by side or stacked)

Required text: accompany these figures with:
- A brief description of the etiology of each extracted reference signature (e.g. SBS1 = clock-like deamination, SBS2/13 = APOBEC activity, SBS4 = tobacco smoking)
- A note on which, if any, de novo signatures were retained as de novo rather than decomposed into reference signatures, and the justification

Reference: COSMIC Mutational Signatures v3.x — https://cancer.sanger.ac.uk/signatures/',
  NULL, 'bash', 'Bioinformatics',
  'mutation signatures, decomposition, SigProfilerAssignment, COSMIC, reference signatures, etiology, APOBEC, SBS1',
  'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: decomposition into reference signatures (Step 4)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Mutation signatures: per-sample breakdown and group comparisons (Steps 5–6)',
  'Step 5 — Per-sample signature breakdown (stacked bar plots)

Required figure: stacked bar plots showing mutational burden split by signature for each sample.
- X-axis: samples (in the same logical order as Step 2)
- Y-axis: mutational burden (absolute counts for WGS/WES; coverage-corrected for single-molecule sequencing)
- Colors: one color per signature. Group and shade signatures by etiology:
  e.g. APOBEC signatures (SBS2, SBS13) → shades of purple; aging/clock-like (SBS1, SBS5) → shades of yellow
  Use the analyst''s discretion and knowledge of the mutational processes.
- Single-molecule sequencing: correct for duplex recovery (or equivalent coverage metric) before plotting.

Step 6 — Per-signature comparisons across groups (boxplots)

Required figure: for each mutational signature, a boxplot comparing groups.
- X-axis: the dependent variable being compared (e.g. treatment condition, cell type, patient group)
- Y-axis: mutational burden attributable to that signature
- One boxplot panel per signature (or grouped into a multi-panel figure)',
  NULL, 'bash', 'Bioinformatics',
  'mutation signatures, stacked bar, boxplot, per-sample, etiology, APOBEC, aging, single-molecule, NanoSeq, visualization',
  'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: per-sample breakdown and group comparisons (Steps 5–6)');
