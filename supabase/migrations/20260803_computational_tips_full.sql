-- STEP 1: Create the table if it doesn't already exist
CREATE TABLE IF NOT EXISTS computational_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  code_snippet text,
  code_language text DEFAULT 'bash',
  category text NOT NULL DEFAULT 'General',
  tags text,
  status text NOT NULL DEFAULT 'published',
  submitted_by uuid,
  submitter_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE computational_tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON computational_tips;
CREATE POLICY "allow_all" ON computational_tips USING (true) WITH CHECK (true);

-- STEP 2: Insert all tips (skips any that already exist by title)

-- ─── HPC ────────────────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'First setup: umask for BigPurple',
'Before doing anything else on BigPurple, set your umask so that file permissions do not cause jobs to fail or block other lab members from accessing shared files. Run the command below, then close and re-open your SSH connection for it to take effect.',
'echo ''umask 027'' >> ~/.bashrc',
'bash','HPC','bigpurple, setup, permissions','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'First setup: umask for BigPurple');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'BigPurple: overview and architecture',
'BigPurple is a compute cluster (a bunch of nodes strung together and networked) that we submit jobs to for computational work. It is structured by login nodes (bigpurple-ln1, bigpurple-ln2, bigpurple-ln3) that you automatically SSH into, and compute nodes where jobs actually run. Workload management is handled by SLURM (https://slurm.schedmd.com/documentation.html).

Partitions:
- cpu_short / cpu_medium / cpu_long — general-purpose CPU nodes (40 cores, ~380 GB memory)
- fn_short / fn_medium / fn_long — fat nodes (64 cores, ~1.5 TB memory)

Docs:
- http://bigpurple-ws.nyumc.org/wiki/index.php/BigPurple_HPC_Cluster
- https://hpcmed.org/guide',
NULL,'bash','HPC','bigpurple, slurm, cluster, partitions, overview','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'BigPurple: overview and architecture');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Storage: use /gpfs/data/petljaklab/, not scratch',
'For all storage needs, use the lab directory and make a subdirectory for yourself:

  /gpfs/data/petljaklab/

Despite what HPC guides say, there is no reliable scratch space in practice. Scratch fills unpredictably and can cause your jobs to fail at 2AM on a Saturday.',
'# Check lab directory quota
mmlsquota -j data_petljaklab --block-size auto gpfs

# Check your home directory quota
mmlsquota -u YOUR_KERBEROS_ID --block-size auto gpfs:home',
'bash','HPC','bigpurple, storage, scratch, gpfs, quota','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Storage: use /gpfs/data/petljaklab/, not scratch');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Key BigPurple commands',
'Quick-reference commands for day-to-day use on BigPurple.',
'# Show all my jobs
squeue --me

# List all nodes/partitions and their status
sinfo

# Submit a job
sbatch -t dd-hh:mm:ss -e error_file -o log_file -p PARTITION jobscript.sh

# Check lab storage quota
mmlsquota -j data_petljaklab --block-size auto gpfs

# Check home directory quota
mmlsquota -u YOUR_KERBEROS_ID --block-size auto gpfs:home',
'bash','HPC','bigpurple, slurm, sbatch, squeue, sinfo, commands','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Key BigPurple commands');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Resource limits: CPU vs fat node partitions',
'The CPU partitions (cpu_short/medium/long) have a resource limit of approximately 360 CPUs and 1.6 TB of memory across all your running jobs. After this, jobs are held in queue.

As a rough rule: if your jobs use more than 9-10 GB of RAM per core/thread, they belong on the fat node partition (fn_*), not cpu. Fat nodes have 64 cores and ~1.5 TB of memory each.',
NULL,'bash','HPC','bigpurple, partitions, cpu, fat nodes, memory, resources','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Resource limits: CPU vs fat node partitions');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Petljaklab private partition (cn-0057)',
'The Petljak lab has a private node on BigPurple called "petljaklab". The node is cn-0057 and has 128 threads (64 physical cores) and 512 GB of RAM.

It is ideally used for running pipelines, but free capacity can be used for other jobs. Try to limit jobs to ~4 GB of RAM per thread for non-fast jobs so we can effectively use the available compute.

You can combine partitions so the scheduler picks the first available slot.',
'# Use only the private partition
sbatch -p petljaklab jobscript.sh

# Combine with cpu_short as fallback
sbatch -p petljaklab,cpu_short jobscript.sh',
'bash','HPC','bigpurple, petljaklab, partition, private node','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljaklab private partition (cn-0057)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Don''t run things on the login nodes',
'Wherever possible, do not run heavy tasks on login nodes (bigpurple-ln1/2/3). HPC prefers you start an interactive session with srun for interactive work. Light/quick tasks for prototyping are generally fine, but if something takes more than a few minutes, get an interactive session or submit a job.',
'# Start an interactive session with 4 CPUs and 16 GB RAM for 2 hours
srun --ntasks=1 --cpus-per-task=4 --mem=16G --time=02:00:00 -p cpu_short --pty bash',
'bash','HPC','bigpurple, login node, interactive, srun, etiquette','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Don''t run things on the login nodes');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Checking /tmp/ usage on compute nodes',
'Many programs write to /tmp/ on compute nodes and can slowly fill that space, causing jobs to fail. Wherever possible, specify /tmp/ for your programs explicitly and delete files after your script runs.

A handy script exists at:
/gpfs/data/petljaklab/lculibrk_prj/scripts/check_tmp.bash

It alerts you when /tmp/ is >50% used and total /tmp is >90% full. Copy it for yourself and set up a cron job.',
'# Run the /tmp/ check on all compute nodes
for i in $(scontrol show node | grep NodeName=cn | sed ''s/NodeName=//g'' | sed ''s/ .*//g''); do
  ssh $i /path/to/check_tmp.bash
done

# Example cron job to run nightly at midnight
0 0 * * * for i in $(scontrol show node | grep NodeName=cn | sed ''s/NodeName=//g'' | sed ''s/ .*//g''); do ssh $i /gpfs/data/petljaklab/lculibrk_prj/scripts/check_tmp.bash; done',
'bash','HPC','bigpurple, tmp, disk space, stewardship, cron, nodes','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Checking /tmp/ usage on compute nodes');

-- ─── Shell ──────────────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Cron: setting up automated jobs on BigPurple',
'Cron is an automator for running programs on Linux at specified times.

Docs:
- https://crontab.guru/
- https://en.wikipedia.org/wiki/Cron

To set up a cron job, run "crontab -e". This opens the vi editor (see the vi navigation tip if unfamiliar).

Important: BigPurple has three login nodes (ln1, ln2, ln3). Cron jobs are specific to the login node you created them on — SSH back to the same node when you need to modify them.',
'# Open your crontab for editing
crontab -e

# List your current cron jobs
crontab -l',
'bash','Shell','cron, automation, bigpurple, scheduling','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Cron: setting up automated jobs on BigPurple');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Cron: job syntax and MAILTO',
'Cron field order: minute  hour  day-of-month  month  day-of-week
An asterisk (*) means "every".

Highly recommended: add a MAILTO line at the top of your crontab so you receive an email with stderr when each job completes.',
'# Add at the top of your crontab to receive email output
MAILTO = your.email@nyulangone.org

# Run ls every day at 00:00
0 0 * * * ls ~/

# Run a script every Monday at 08:00
0 8 * * 1 /path/to/script.bash

# Run every 30 minutes
*/30 * * * * /path/to/script.bash',
'bash','Shell','cron, scheduling, mailto, syntax, automation','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Cron: job syntax and MAILTO');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Navigating vi for crontab -e',
'"crontab -e" opens the vi text editor, which is notoriously confusing for first-time users. You only need four things:

1. Start editing: press i  (enters Insert mode)
2. Stop editing: press Escape
3. Save and exit: press Escape, then type :wq and press Enter
4. Quit without saving: press Escape, then type :q! and press Enter',
NULL,'bash','Shell','vi, vim, crontab, text editor','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Navigating vi for crontab -e');

-- ─── Software ───────────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'OnDemand: interactive RStudio and other apps on BigPurple',
'OnDemand lets you launch interactive browser-based sessions on BigPurple — most usefully RStudio.

1. Go to the OnDemand website (ondemand)
2. Click "My Interactive Sessions" at the top
3. Select an app from the left — "Rstudio (New)" is recommended
4. Default settings are usually fine; during peak hours there may be a wait for cpu_ jobs

To reduce wait times, use less-congested fn_ (fat node) partitions:
- Run "sinfo" to see which partitions have idle nodes
- Under session options click "Advanced" and select e.g. "fn_short"
- Fat nodes require at least 8 GB of memory per core',
'sinfo',
'bash','Software','bigpurple, ondemand, rstudio, interactive, fn_short','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'OnDemand: interactive RStudio and other apps on BigPurple');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'VSCode Remote: edit files on BigPurple from your laptop',
'VSCode Remote SSH lets you work with files on BigPurple as if they were local.

Setup:
1. Install VSCode (https://code.visualstudio.com/)
2. Open Extensions (left sidebar), search "remote", install "Remote - SSH"
3. Click the small blue icon at the bottom-left of VSCode
4. Click Connect to Host > Configure SSH Hosts > select ~/.ssh/config
5. Add the block below (replace culibl01 with your Kerberos ID — case sensitive)
6. Save, then: blue icon > Connect to Host > bigpurple.nyumc.org
7. Enter your password when prompted',
'# Add to ~/.ssh/config on your laptop:
Host bigpurple.nyumc.org
    HostName bigpurple.nyumc.org
    User culibl01',
'bash','Software','vscode, remote ssh, bigpurple, ide, setup','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'VSCode Remote: edit files on BigPurple from your laptop');

-- ─── R ──────────────────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'R cheat sheets: ggplot2, tidyr, dplyr',
'Quick-reference PDFs for the most commonly used R packages.

Data wrangling (tidyr/dplyr):
https://www.rstudio.com/wp-content/uploads/2015/02/data-wrangling-cheatsheet.pdf

ggplot2 visualisation:
https://www.maths.usyd.edu.au/u/UG/SM/STAT3022/r/current/Misc/data-visualization-2.1.pdf',
NULL,'r','R','ggplot2, tidyr, dplyr, cheat sheet, visualisation','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'R cheat sheets: ggplot2, tidyr, dplyr');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'R performance: apply functions and pre-allocating objects',
'R being slow is often a misconception — it is fast in most cases, but inefficient patterns are common:

1. Use apply/lapply/sapply/vapply instead of for loops wherever possible.

2. If you must use a for loop, pre-allocate the output before the loop. Appending to an object inside a loop forces R to copy the entire object on every iteration — very expensive.

See the R Inferno: https://www.burns-stat.com/pages/Tutor/R_inferno.pdf',
'# BAD: growing a vector by appending (slow)
result <- c()
for (i in 1:10000) {
  result <- c(result, i^2)
}

# GOOD: pre-allocate
result <- numeric(10000)
for (i in 1:10000) {
  result[i] <- i^2
}

# BEST: use vapply
result <- vapply(1:10000, function(i) i^2, numeric(1))',
'r','R','performance, for loops, apply, lapply, vapply, optimisation','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'R performance: apply functions and pre-allocating objects');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'R performance: data.table for large table operations',
'For large dataframe operations (joins, reshaping, filtering), use data.table instead of tidyverse. In benchmarks it outperforms even frameworks like Spark.

Benchmark: https://h2oai.github.io/db-benchmark/

Ask Luka for help — resident data.table stan.',
'library(data.table)

# Convert data.frame to data.table
dt <- as.data.table(my_df)

# Fast long-to-wide reshape
wide_dt <- dcast(dt, sample_id ~ variant_id, value.var = "VAF")

# Fast join
result <- dt1[dt2, on = "sample_id"]

# Fast filter
dt[VAF > 0.1 & coverage >= 20]',
'r','R','data.table, performance, joins, reshape, dcast, large data','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'R performance: data.table for large table operations');

-- ─── Bioinformatics: Petljakdb ──────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Petljakdb: MySQL database overview',
'We have a MySQL server on BigPurple for storing and querying study/sample/run/analysis metadata. Ask Luka for a database account.

Connection details:
- Host: "db"
- Port: 33100

ID prefixes:
- MPP — project/study
- MPS — sample
- MPR — sequencing run
- MPA — analysis

Tables:
- studies — one row per project
- samples — one row per sample
- runs — one row per sequencing run
- analyses — one row per analysis
- cells — cell lines sequenced; enables cross-study queries',
NULL,'sql','Bioinformatics','petljakdb, mysql, database, metadata, samples, overview','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: MySQL database overview');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Petljakdb: connecting from the command line',
'Access petljakdb from a BigPurple login node. You need a database account (ask Luka).',
'# Load MariaDB module
module load mariadb

# Connect interactively
mysql -u "YOUR_USERNAME" -p -h db --port 33100

# Inside MySQL:
USE petljakdb;
SHOW TABLES;

# Dump a query to a text file (run from bash)
mysql -u "YOUR_USERNAME" -p -h db --port 33100 \
  -B --database=petljakdb \
  --execute "SELECT * FROM samples WHERE study_id=3;" \
  > output.txt',
'bash','Bioinformatics','petljakdb, mysql, mariadb, command line, connection','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: connecting from the command line');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Petljakdb: common MySQL query examples',
'Useful reference queries for petljakdb. The trailing semicolon is required.',
'-- Show all rows in any table
SELECT * FROM petljakdb.studies;
SELECT * FROM petljakdb.samples;

-- Describe a table schema
DESCRIBE petljakdb.samples;

-- All samples from study MPP000003
SELECT * FROM petljakdb.samples WHERE study_id = 3;

-- All BC-1 cells across all studies
SELECT * FROM petljakdb.samples
WHERE cell_id = (SELECT id FROM petljakdb.cells WHERE rname = ''BC-1'');

-- WGS BAM/CRAM paths for a study
SELECT id, analysis_dir FROM petljakdb.analyses
WHERE analysis_type = ''WGS_MERGE_BAM''
  AND analysis_complete = ''True''
  AND studies_id = 1;',
'sql','Bioinformatics','petljakdb, mysql, queries, sql, samples, studies','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: common MySQL query examples');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Petljakdb: querying from R (RMySQL)',
'Query petljakdb directly from an R session running on BigPurple (e.g. via OnDemand RStudio). Always close the connection when done.',
'library(RMySQL)

con <- RMySQL::dbConnect(
  MySQL(),
  user     = "YOUR_USERNAME",
  password = "YOUR_PASSWORD",
  host     = "db",
  port     = 33100,
  dbname   = "petljakdb"
)

rs <- dbSendQuery(con, "SELECT rname FROM petljakdb.samples WHERE study_id = 3;")
results <- dbFetch(rs)
dbDisconnect(con)',
'r','Bioinformatics','petljakdb, mysql, R, RMySQL, database','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: querying from R (RMySQL)');

-- ─── Bioinformatics: Mutation Signatures ────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Mutation signatures: terminology and mutation types',
'Standard definitions used across mutational signature analysis in the lab.

Single base substitutions (SBS): a single base change, e.g. C>T in a TCA context. Also called SNVs (or SNPs for germline).

Indels (IDs): insertions or deletions of DNA under 50 bp in size.

Structural variations (SVs): large duplications, insertions, deletions, inversions, or translocations — larger than indels.

Copy number variants (CNVs): a subset of SVs involving large duplications or deletions.

Mutational burden units:
- SBS / ID / SV: total number of events per sample. For single-molecule sequencing (e.g. NanoSeq), express as mutations per (mega)base or per diploid cell to correct for coverage — see Abascal 2021.
- CNV: no single standard metric. Common options: fraction genome altered (FGA), CNV segment count, CNV segment sizes.',
NULL,'bash','Bioinformatics','mutation signatures, SBS, indels, SVs, CNVs, terminology, NanoSeq, SNV','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: terminology and mutation types');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Mutation signatures: standard analysis workflow overview',
'The standard mutational signature analysis follows six sequential steps, each with required figures:

Step 1 — Mutational burden overview
Step 2 — Mutational spectra overview
Step 3 — De novo signature extraction and selection (SigProfilerExtractor)
Step 4 — Signature decomposition into reference signatures (SigProfilerAssignment)
Step 5 — Per-sample signature breakdown (stacked bar plots)
Step 6 — Per-signature comparisons across groups (boxplots)

Each step is described in its own tip.',
NULL,'bash','Bioinformatics','mutation signatures, workflow, analysis outline, SigProfilerExtractor, SigProfilerAssignment','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: standard analysis workflow overview');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Mutation signatures: visualizing mutational burden (Step 1)',
'Required figures for summarizing mutational burden across samples.

For SBS, ID, and SV (discrete events):
- In WGS/WES, report as total number of events per sample (burden is invariant to sequencing depth).
- Figure 1a: barplot — burden (y-axis) per sample (x-axis).
- Figure 1b: boxplot — burden (y-axis) per experimental group (x-axis).
- Single-molecule sequencing: correct for coverage (e.g. duplex recovery) and express as mutations per (mega)base or per diploid cell.

For CNVs, choose one metric and use it consistently:
- Fraction genome altered (FGA): fraction of genome that is non-diploid.
- CNV segment count: total number of distinct copy number segments.
- CNV segment sizes: distribution of segment lengths.
Present using the same barplot + boxplot format.',
NULL,'bash','Bioinformatics','mutation signatures, mutational burden, barplot, boxplot, CNV, CIN, FGA, NanoSeq','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: visualizing mutational burden (Step 1)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Mutation signatures: mutational spectra overview (Step 2)',
'Required figure: the total mutational spectrum for each biological sample.

For whichever channel paradigm is used (SBS 96-channel, ID 83- or 89-channel, SV, CNV, etc.), produce a figure showing the complete mutational spectrum per sample.

Layout convention:
- Rows = samples
- Columns = dependent variables (experimental groupings)

Samples should be in a logical order that makes comparisons across conditions clear. This gives reviewers an intuitive view of the raw mutation patterns before any signature decomposition.',
NULL,'bash','Bioinformatics','mutation signatures, mutational spectra, SBS, 96-channel, ID, 83-channel, visualization','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: mutational spectra overview (Step 2)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Mutation signatures: de novo extraction and signature selection (Step 3)',
'Tool: SigProfilerExtractor (https://github.com/AlexandrovLab/SigProfilerExtractor)

Run de novo signature extraction. SigProfilerExtractor produces a stability plot for signature count selection showing:
- X-axis: number of signatures extracted
- Y-axis: stability metrics (mean sample stability, sample cosine distance)

Required figure: include the SigProfilerExtractor stability plot.

Required text: brief explanation of which signature solution was selected and why (e.g. "We selected the N-signature solution because it maximised mean sample stability while the N+1 solution introduced an unstable signature with cosine similarity >0.95 to an existing one").',
NULL,'bash','Bioinformatics','mutation signatures, de novo extraction, SigProfilerExtractor, signature selection, stability, cosine distance','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: de novo extraction and signature selection (Step 3)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Mutation signatures: decomposition into reference signatures (Step 4)',
'Tool: SigProfilerAssignment (https://github.com/AlexandrovLab/SigProfilerAssignment)

After de novo extraction, decompose each de novo signature into COSMIC reference mutational signatures.

Required figures (from SigProfilerAssignment output): for each de novo signature, show:
1. The de novo signature spectrum
2. Its decomposition into reference signatures

Required text:
- Brief description of the etiology of each extracted reference signature (e.g. SBS1 = clock-like deamination, SBS2/13 = APOBEC activity, SBS4 = tobacco smoking)
- Note on which de novo signatures were retained as de novo rather than decomposed, and the justification

Reference: COSMIC Mutational Signatures v3.x — https://cancer.sanger.ac.uk/signatures/',
NULL,'bash','Bioinformatics','mutation signatures, decomposition, SigProfilerAssignment, COSMIC, reference signatures, etiology, APOBEC, SBS1','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: decomposition into reference signatures (Step 4)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT 'Mutation signatures: per-sample breakdown and group comparisons (Steps 5-6)',
'Step 5 — Per-sample signature breakdown (stacked bar plots)

Required figure: stacked bar plots showing mutational burden split by signature for each sample.
- X-axis: samples (same order as Step 2)
- Y-axis: mutational burden (absolute counts for WGS/WES; coverage-corrected for single-molecule sequencing)
- Colors: one per signature, grouped and shaded by etiology:
  e.g. APOBEC signatures (SBS2, SBS13) in shades of purple; aging/clock-like (SBS1, SBS5) in shades of yellow
- Single-molecule sequencing: correct for duplex recovery before plotting.

Step 6 — Per-signature comparisons across groups (boxplots)

Required figure: for each mutational signature, a boxplot comparing groups.
- X-axis: the dependent variable (e.g. treatment condition, cell type, patient group)
- Y-axis: mutational burden attributable to that signature
- One panel per signature, arranged in a multi-panel figure',
NULL,'bash','Bioinformatics','mutation signatures, stacked bar, boxplot, per-sample, etiology, APOBEC, aging, single-molecule, NanoSeq','published','Luka',now(),now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Mutation signatures: per-sample breakdown and group comparisons (Steps 5-6)');
