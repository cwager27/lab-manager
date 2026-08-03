const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = { sendMail: async () => {} }; // emails disabled

const assignmentRoutes = require('./routes/assignments');
const checklistRoutes = require('./routes/checklists');
const sporadicRoutes = require('./routes/sporadic');
const vacationRoutes = require('./routes/vacation');
const { router: meetingRoutes, checkPendingConfirmations } = require('./routes/meetings');
const { router: complianceRoutes, checkCertificateExpiries, checkPolicyReminders } = require('./routes/compliance');
const { router: backupRoutes, runBackup } = require('./routes/backup');
const { router: financeRoutes, checkGrantAlerts } = require('./routes/finance');
const memberRoutes = require('./routes/members');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const benchlingRoutes = require('./routes/benchling');
const { generateOccurrences } = require('./lib/occurrenceGenerator');
const { supabaseAdmin } = require('./lib/supabaseAdmin');

app.use('/api', assignmentRoutes);
app.use('/api', checklistRoutes);
app.use('/api', sporadicRoutes);
app.use('/api', vacationRoutes);
app.use('/api', meetingRoutes);
app.use('/api', complianceRoutes);
app.use('/api', backupRoutes);
app.use('/api', financeRoutes);
app.use('/api', memberRoutes);
app.use('/api', authRoutes);
app.use('/api', taskRoutes);
app.use('/api', benchlingRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Lab Manager API is running' });
});

function taskReminderHtml(name, taskName, dueDate, message) {
  const fmt = new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fff;">
    <h1 style="color:#7B3FA0;margin:0 0 24px;font-size:20px;">PETLJAK LAB</h1>
    <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi ${name},</p>
    <p style="color:#333;font-size:15px;margin:0 0 20px;">${message}</p>
    <div style="background:#F5EEF8;border-left:4px solid #7B3FA0;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <strong style="color:#7B3FA0;font-size:17px;">${taskName}</strong>
      <p style="color:#555;margin:8px 0 0;font-size:13px;">Due: ${fmt}</p>
    </div>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Lab Manager</a>
  </div>`;
}

function taskOverdueNoticeHtml(pmName, assigneeName, taskName, dueDate) {
  const fmt = new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fff;">
    <h1 style="color:#7B3FA0;margin:0 0 24px;font-size:20px;">PETLJAK LAB</h1>
    <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi ${pmName},</p>
    <p style="color:#333;font-size:15px;margin:0 0 20px;">A task was not completed by its due date:</p>
    <div style="background:#FDEDEC;border-left:4px solid #E74C3C;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <strong style="color:#C0392B;font-size:17px;">${taskName}</strong>
      <p style="color:#555;margin:8px 0 0;font-size:13px;">Was due: ${fmt}</p>
      <p style="color:#555;margin:4px 0 0;font-size:13px;">Assigned to: ${assigneeName}</p>
    </div>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#E74C3C;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in Lab Manager</a>
  </div>`;
}

async function runDailyChecks() {
  console.log('Running daily checks...');
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const { data: assignments } = await supabase
    .from('task_assignments').select('*, profiles(email, full_name)').neq('status', 'submitted');
  for (const a of (assignments || [])) {
    const due = a.cycle_end;
    let status = due === today ? 'due today' : due === tomorrow ? 'due tomorrow' : due < today ? 'overdue' : null;
    if (status) await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: a.profiles.email,
      subject: `Petljak Lab — Checklist Reminder: ${status}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;"><h1 style="color:#7B3FA0;">PETLJAK LAB</h1><p>Hi ${a.profiles.full_name}, your checklist is <strong>${status}</strong>.</p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Complete Now</a></div>`
    });
  }

  const { data: sporadic } = await supabase
    .from('sporadic_tasks').select('*, profiles!sporadic_tasks_assigned_to_fkey(email, full_name)').neq('status', 'submitted');
  for (const t of (sporadic || [])) {
    const due = t.due_date;
    let status = due === today ? 'due today' : due === tomorrow ? 'due tomorrow' : due < today ? 'overdue' : null;
    if (status && t.profiles) await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: t.profiles.email,
      subject: `Petljak Lab — Task Reminder: ${t.title} is ${status}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;"><h1 style="color:#7B3FA0;">PETLJAK LAB</h1><p>Hi ${t.profiles.full_name}, your task <strong>${t.title}</strong> is <strong>${status}</strong>.</p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Complete Now</a></div>`
    });
  }

  // ── Tasks2.0 occurrence reminders ──────────────────────────────────────────
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Day before: remind assignee
  const { data: dueTomorrow } = await supabaseAdmin
    .from('task_occurrences')
    .select('id, due_date, task_def:tasks_definitions(title, group_name), assignee:profiles!assigned_to(email, full_name)')
    .eq('due_date', tomorrow)
    .not('assigned_to', 'is', null)
    .neq('status', 'done');

  for (const occ of (dueTomorrow || [])) {
    if (!occ.assignee?.email) continue;
    const taskName = occ.task_def?.group_name || occ.task_def?.title || 'Task';
    await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: occ.assignee.email,
      subject: `Petljak Lab — Task due tomorrow: ${taskName}`,
      html: taskReminderHtml(occ.assignee.full_name, taskName, occ.due_date, 'Your task is due tomorrow — please complete it on time:'),
    });
  }

  // Day after: remind assignee + notify all PMs/admins
  const { data: overdueFirst } = await supabaseAdmin
    .from('task_occurrences')
    .select('id, due_date, task_def:tasks_definitions(title, group_name), assignee:profiles!assigned_to(email, full_name)')
    .eq('due_date', yesterday)
    .not('assigned_to', 'is', null)
    .neq('status', 'done');

  const { data: pmProfiles } = (overdueFirst || []).length
    ? await supabaseAdmin.from('profiles').select('email, full_name').in('role', ['pm', 'admin'])
    : { data: [] };

  for (const occ of (overdueFirst || [])) {
    const taskName = occ.task_def?.group_name || occ.task_def?.title || 'Task';
    if (occ.assignee?.email) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: occ.assignee.email,
        subject: `Petljak Lab — Overdue task: ${taskName}`,
        html: taskReminderHtml(occ.assignee.full_name, taskName, occ.due_date, 'Your task is now overdue — please complete it as soon as possible:'),
      });
    }
    for (const pm of (pmProfiles || [])) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: pm.email,
        subject: `Petljak Lab — Task not completed: ${taskName}`,
        html: taskOverdueNoticeHtml(pm.full_name, occ.assignee?.full_name || 'Unknown', taskName, occ.due_date),
      });
    }
  }

  // await checkGrantAlerts(); // paused
  await generateOccurrences(supabaseAdmin, { windowDays: 90 });
  await checkPendingConfirmations();
  await checkCertificateExpiries();
  await checkPolicyReminders();
  await runBackup();
}

// Run via node-cron when running locally/always-on
if (process.env.NODE_ENV !== 'production') {
  cron.schedule('0 8 * * *', runDailyChecks);
}

// Endpoint for Vercel Cron to trigger daily checks in production
app.get('/api/cron-daily', async (req, res) => {
  try {
    await runDailyChecks();
    res.json({ success: true });
  } catch (error) {
    console.error('Cron daily error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
