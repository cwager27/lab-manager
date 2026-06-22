const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const assignmentRoutes = require('./routes/assignments');
const checklistRoutes = require('./routes/checklists');
const sporadicRoutes = require('./routes/sporadic');
const vacationRoutes = require('./routes/vacation');
const { router: meetingRoutes, checkPendingConfirmations } = require('./routes/meetings');
const { router: complianceRoutes, checkCertificateExpiries, checkPolicyReminders } = require('./routes/compliance');
const { router: backupRoutes, runBackup } = require('./routes/backup');
const { router: financeRoutes, checkGrantAlerts } = require('./routes/finance');
const memberRoutes = require('./routes/members');

app.use('/api', assignmentRoutes);
app.use('/api', checklistRoutes);
app.use('/api', sporadicRoutes);
app.use('/api', vacationRoutes);
app.use('/api', meetingRoutes);
app.use('/api', complianceRoutes);
app.use('/api', backupRoutes);
app.use('/api', financeRoutes);
app.use('/api', memberRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Lab Manager API is running' });
});

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

  await checkGrantAlerts();
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
