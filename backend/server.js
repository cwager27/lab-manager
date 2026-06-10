const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Routes
const assignmentRoutes = require('./routes/assignments');
const checklistRoutes = require('./routes/checklists');
const sporadicRoutes = require('./routes/sporadic');
const vacationRoutes = require('./routes/vacation');
app.use('/api', assignmentRoutes);
app.use('/api', checklistRoutes);
app.use('/api', sporadicRoutes);
app.use('/api', vacationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Lab Manager API is running' });
});

// Daily reminder check at 8am
cron.schedule('0 8 * * *', async () => {
  console.log('Running daily reminder check...');
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // System 1 reminders
  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('*, profiles(email, full_name)')
    .neq('status', 'submitted');

  for (const assignment of (assignments || [])) {
    const due = assignment.cycle_end;
    let status = null;
    if (due === today) status = 'due today';
    else if (due === tomorrow) status = 'due tomorrow';
    else if (due < today) status = 'overdue';

    if (status) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: assignment.profiles.email,
        subject: `Petljak Lab — Checklist Reminder: ${status}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #7B3FA0;">PETLJAK LAB</h1>
            <p>Hi ${assignment.profiles.full_name},</p>
            <p>Your assigned checklist is <strong>${status}</strong>.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
              style="display: inline-block; padding: 12px 24px; background: #7B3FA0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Complete Checklist Now
            </a>
          </div>
        `
      });
    }
  }

  // System 2 sporadic reminders
  const { data: sporadicTasks } = await supabase
    .from('sporadic_tasks')
    .select('*, profiles!sporadic_tasks_assigned_to_fkey(email, full_name)')
    .neq('status', 'submitted');

  for (const task of (sporadicTasks || [])) {
    const due = task.due_date;
    let status = null;
    if (due === today) status = 'due today';
    else if (due === tomorrow) status = 'due tomorrow';
    else if (due < today) status = 'overdue';

    if (status && task.profiles) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: task.profiles.email,
        subject: `Petljak Lab — Task Reminder: ${task.title} is ${status}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #7B3FA0;">PETLJAK LAB</h1>
            <p>Hi ${task.profiles.full_name},</p>
            <p>Your task <strong>${task.title}</strong> is <strong>${status}</strong>.</p>
            <p>Due date: ${task.due_date}</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
              style="display: inline-block; padding: 12px 24px; background: #7B3FA0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Complete Task Now
            </a>
          </div>
        `
      });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
