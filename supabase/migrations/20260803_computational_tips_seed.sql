-- Seed: BigPurple HPC Tips and Tricks (from Luka Culibrk's lab documentation)
-- Safe to run multiple times — each statement only inserts if that title doesn't already exist.

-- ─── HPC ────────────────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'First setup: umask for BigPurple',
  'Before doing anything else on BigPurple, set your umask so that file permissions do not cause jobs to fail or block other lab members from accessing shared files. Run the command below, then close and re-open your SSH connection for it to take effect.',
  'echo ''umask 027'' >> ~/.bashrc',
  'bash', 'HPC', 'bigpurple, setup, permissions', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'First setup: umask for BigPurple');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'BigPurple: overview and architecture',
  'BigPurple is a compute cluster (a bunch of nodes strung together and networked) that we submit jobs to for computational work. It is structured by login nodes (bigpurple-ln1, bigpurple-ln2, bigpurple-ln3) that you automatically SSH into, and compute nodes where jobs actually run. Workload management is handled by SLURM (https://slurm.schedmd.com/documentation.html).

Partitions:
- cpu_short / cpu_medium / cpu_long — general-purpose CPU nodes (40 cores, ~380 GB memory)
- fn_short / fn_medium / fn_long — fat nodes (64 cores, ~1.5 TB memory)

Docs:
- http://bigpurple-ws.nyumc.org/wiki/index.php/BigPurple_HPC_Cluster
- https://hpcmed.org/guide',
  NULL, 'bash', 'HPC', 'bigpurple, slurm, cluster, partitions, overview', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'BigPurple: overview and architecture');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Storage: use /gpfs/data/petljaklab/, not scratch',
  'For all storage needs, use the lab directory and make a subdirectory for yourself:

  /gpfs/data/petljaklab/

Despite what HPC guides say, there is no reliable scratch space in practice. Scratch fills unpredictably and can cause your jobs to fail at 2AM on a Saturday.',
  '# Check lab directory quota
mmlsquota -j data_petljaklab --block-size auto gpfs

# Check your home directory quota
mmlsquota -u YOUR_KERBEROS_ID --block-size auto gpfs:home',
  'bash', 'HPC', 'bigpurple, storage, scratch, gpfs, quota', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Storage: use /gpfs/data/petljaklab/, not scratch');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Key BigPurple commands',
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
  'bash', 'HPC', 'bigpurple, slurm, sbatch, squeue, sinfo, commands', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Key BigPurple commands');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Resource limits: CPU vs fat node partitions',
  'The CPU partitions (cpu_short/medium/long) have a resource limit of approximately 360 CPUs and 1.6 TB of memory across all your running jobs. After this, jobs are held in queue.

As a rough rule: if your jobs use more than 9–10 GB of RAM per core/thread, they belong on the fat node partition (fn_*), not cpu. Fat nodes have 64 cores and ~1.5 TB of memory each.',
  NULL, 'bash', 'HPC', 'bigpurple, partitions, cpu, fat nodes, memory, resources', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Resource limits: CPU vs fat node partitions');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Petljaklab private partition (cn-0057)',
  'The Petljak lab has a private node on BigPurple called "petljaklab". The node is cn-0057 and has 128 threads (64 physical cores) and 512 GB of RAM.

It is ideally used for running pipelines, but free capacity can be used for other jobs. Try to limit jobs to ~4 GB of RAM per thread for non-fast jobs so we can effectively use the available compute.

You can combine partitions so the scheduler picks the first available slot.',
  '# Use only the private partition
sbatch -p petljaklab jobscript.sh

# Combine with cpu_short as fallback
sbatch -p petljaklab,cpu_short jobscript.sh',
  'bash', 'HPC', 'bigpurple, petljaklab, partition, private node', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljaklab private partition (cn-0057)');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Don''t run things on the login nodes',
  'Wherever possible, do not run heavy tasks on login nodes (bigpurple-ln1/2/3). HPC prefers you start an interactive session with srun for interactive work. Light/quick tasks for prototyping are generally fine, but if something takes more than a few minutes, get an interactive session or submit a job.',
  '# Start an interactive session with 4 CPUs and 16 GB RAM for 2 hours
srun --ntasks=1 --cpus-per-task=4 --mem=16G --time=02:00:00 -p cpu_short --pty bash',
  'bash', 'HPC', 'bigpurple, login node, interactive, srun, etiquette', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Don''t run things on the login nodes');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Checking /tmp/ usage on compute nodes',
  'Many programs write to /tmp/ on compute nodes and can slowly fill that space, causing jobs to fail. Wherever possible, specify /tmp/ for your programs explicitly and delete files after your script runs.

A handy script exists at:
/gpfs/data/petljaklab/lculibrk_prj/scripts/check_tmp.bash

It alerts you when /tmp/ is >50% used and the total /tmp is >90% full. Copy it for yourself and set up a cron job to run it regularly.',
  '# Run the /tmp/ check on all compute nodes
for i in $(scontrol show node | grep NodeName=cn | sed ''s/NodeName=//g'' | sed ''s/ .*//g''); do
  ssh $i /path/to/check_tmp.bash
done

# Example cron job to run nightly at midnight
0 0 * * * for i in $(scontrol show node | grep NodeName=cn | sed ''s/NodeName=//g'' | sed ''s/ .*//g''); do ssh $i /gpfs/data/petljaklab/lculibrk_prj/scripts/check_tmp.bash; done',
  'bash', 'HPC', 'bigpurple, tmp, disk space, stewardship, cron, nodes', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Checking /tmp/ usage on compute nodes');

-- ─── Shell (Cron) ───────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Cron: setting up automated jobs on BigPurple',
  'Cron is an automator for running programs on Linux at specified times — useful for tasks that need to run at regular intervals (e.g. checking disk usage, triggering pipelines, sending reports).

Docs:
- https://crontab.guru/
- https://en.wikipedia.org/wiki/Cron

To set up a cron job, run "crontab -e". This opens the vi editor (see the vi navigation tip if unfamiliar).

Important: BigPurple has three login nodes (ln1, ln2, ln3). Cron jobs are specific to the login node you created them on — SSH back to the same node when you need to modify them.',
  '# Open your crontab for editing
crontab -e

# List your current cron jobs
crontab -l',
  'bash', 'Shell', 'cron, automation, bigpurple, scheduling', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Cron: setting up automated jobs on BigPurple');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Cron: job syntax and MAILTO',
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
  'bash', 'Shell', 'cron, scheduling, mailto, syntax, automation', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Cron: job syntax and MAILTO');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Navigating vi for crontab -e',
  '"crontab -e" opens the vi text editor, which is notoriously confusing for first-time users. You only need four things:

1. Start editing: press i  (enters Insert mode)
2. Stop editing: press Escape
3. Save and exit: press Escape, then type :wq and press Enter
4. Quit without saving: press Escape, then type :q! and press Enter

That is genuinely all you need to manage your crontab.',
  NULL, 'bash', 'Shell', 'vi, vim, crontab, text editor', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Navigating vi for crontab -e');

-- ─── Software ───────────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'OnDemand: interactive RStudio and other apps on BigPurple',
  'OnDemand lets you launch interactive browser-based sessions on BigPurple — most usefully RStudio.

1. Go to the OnDemand website (ondemand)
2. Click "My Interactive Sessions" at the top
3. Select an app from the left — "Rstudio (New)" is recommended
4. Default settings are usually fine; during peak hours there may be a wait for cpu_ jobs

To reduce wait times, use less-congested fn_ (fat node) partitions:
- Run "sinfo" to see which partitions have idle nodes
- Under session options click "Advanced" and select e.g. "fn_short"
- Fat nodes require at least 8 GB of memory per core — requesting less may route the job to cpu or queue it indefinitely',
  'sinfo',
  'bash', 'Software', 'bigpurple, ondemand, rstudio, interactive, fn_short', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'OnDemand: interactive RStudio and other apps on BigPurple');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'VSCode Remote: edit files on BigPurple from your laptop',
  'VSCode Remote SSH lets you work with files on BigPurple as if they were local — edit code, view images, browse the filesystem.

Setup:
1. Install VSCode (https://code.visualstudio.com/)
2. Open Extensions (left sidebar), search "remote", install "Remote - SSH"
3. Click the small blue icon at the bottom-left of VSCode
4. Click Connect to Host → Configure SSH Hosts → select ~/.ssh/config
5. Add the block below (replace culibl01 with your Kerberos ID — case sensitive)
6. Save, then: blue icon → Connect to Host → bigpurple.nyumc.org
7. Enter your password when prompted',
  '# Add to ~/.ssh/config on your laptop:
Host bigpurple.nyumc.org
    HostName bigpurple.nyumc.org
    User culibl01',
  'bash', 'Software', 'vscode, remote ssh, bigpurple, ide, setup', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'VSCode Remote: edit files on BigPurple from your laptop');

-- ─── R ──────────────────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'R cheat sheets: ggplot2, tidyr, dplyr',
  'Quick-reference PDFs for the most commonly used R packages.

Data wrangling (tidyr/dplyr):
https://www.rstudio.com/wp-content/uploads/2015/02/data-wrangling-cheatsheet.pdf

ggplot2 visualisation:
https://www.maths.usyd.edu.au/u/UG/SM/STAT3022/r/current/Misc/data-visualization-2.1.pdf',
  NULL, 'r', 'R', 'ggplot2, tidyr, dplyr, cheat sheet, visualisation', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'R cheat sheets: ggplot2, tidyr, dplyr');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'R performance: apply functions and pre-allocating objects',
  'R being slow is often a misconception — it is fast in most cases, but inefficient patterns are common:

1. Use apply/lapply/sapply/vapply instead of for loops wherever possible.

2. If you must use a for loop and collect results, pre-allocate the output before the loop. Appending to an object inside a loop forces R to copy the entire object on every iteration — very expensive.

See the R Inferno for more patterns to avoid:
https://www.burns-stat.com/pages/Tutor/R_inferno.pdf',
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
  'r', 'R', 'performance, for loops, apply, lapply, vapply, optimisation', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'R performance: apply functions and pre-allocating objects');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'R performance: data.table for large table operations',
  'For large dataframe operations (joins, reshaping, filtering), use data.table instead of tidyverse. In benchmarks it outperforms even frameworks like Spark.

Benchmark reference: https://h2oai.github.io/db-benchmark/

data.table has its own syntax quirks — ask Luka for help (resident data.table stan).',
  'library(data.table)

# Convert data.frame to data.table
dt <- as.data.table(my_df)

# Fast long-to-wide reshape
wide_dt <- dcast(dt, sample_id ~ variant_id, value.var = "VAF")

# Fast join
result <- dt1[dt2, on = "sample_id"]

# Fast filter
dt[VAF > 0.1 & coverage >= 20]',
  'r', 'R', 'data.table, performance, joins, reshape, dcast, large data', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'R performance: data.table for large table operations');

-- ─── Bioinformatics ─────────────────────────────────────────────────────────

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Petljakdb: MySQL database overview',
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
  NULL, 'sql', 'Bioinformatics', 'petljakdb, mysql, database, metadata, samples, overview', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: MySQL database overview');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Petljakdb: connecting from the command line',
  'Access petljakdb from a BigPurple login node. You need a database account (ask Luka). To dump results to a file, use the bash one-liner rather than piping inside the MySQL prompt.',
  '# Load MariaDB module
module load mariadb

# Connect interactively (enter your password when prompted)
mysql -u "YOUR_USERNAME" -p -h db --port 33100

# Inside MySQL:
USE petljakdb;
SHOW TABLES;

# Dump a query to a text file (run from bash, not inside MySQL)
mysql -u "YOUR_USERNAME" -p -h db --port 33100 \
  -B --database=petljakdb \
  --execute "SELECT * FROM samples WHERE study_id=3;" \
  > output.txt',
  'bash', 'Bioinformatics', 'petljakdb, mysql, mariadb, command line, connection', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: connecting from the command line');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Petljakdb: common MySQL query examples',
  'Useful reference queries for petljakdb. The trailing semicolon is required. ChatGPT can also help write more complex queries.',
  '-- Show all rows in any table
SELECT * FROM petljakdb.studies;
SELECT * FROM petljakdb.samples;
SELECT * FROM petljakdb.runs;
SELECT * FROM petljakdb.analyses;

-- Describe a table schema
DESCRIBE petljakdb.samples;

-- All samples from study MPP000003
SELECT * FROM petljakdb.samples WHERE study_id = 3;

-- All BC-1 cells across all studies
SELECT * FROM petljakdb.samples
WHERE cell_id = (SELECT id FROM petljakdb.cells WHERE rname = ''BC-1'');

-- WGS BAM/CRAM paths for a study
SELECT id, analysis_dir
FROM petljakdb.analyses
WHERE analysis_type = ''WGS_MERGE_BAM''
  AND analysis_complete = ''True''
  AND studies_id = 1;',
  'sql', 'Bioinformatics', 'petljakdb, mysql, queries, sql, samples, studies', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: common MySQL query examples');

INSERT INTO computational_tips (title, body, code_snippet, code_language, category, tags, status, submitter_name, created_at, updated_at)
SELECT
  'Petljakdb: querying from R (RMySQL)',
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

# Send a query
rs <- dbSendQuery(con, "SELECT rname FROM petljakdb.samples WHERE study_id = 3;")

# Fetch results as a data.frame
results <- dbFetch(rs)

# Always close when done
dbDisconnect(con)',
  'r', 'Bioinformatics', 'petljakdb, mysql, R, RMySQL, database', 'published', 'Luka', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM computational_tips WHERE title = 'Petljakdb: querying from R (RMySQL)');
