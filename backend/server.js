const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Routes
const assignmentRoutes = require('./routes/assignments');
app.use('/api', assignmentRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Lab Manager API is running' });
});

// Daily reminder check at 8am
cron.schedule('0 8 * * *', async () => {
  console.log('Running daily reminder check...');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('*, profiles(email, full_name), tasks_definitions(title)')
    .neq('status', 'submitted');

  for (const assignment of (assignments || [])) {
    const due = assignment.cycle_end;
    let status = null;

    if (due === today) status = 'due today';
    else if (due === tomorrow) status = 'due tomorrow';
    else if (due < today) status = 'overdue';

    if (status) {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: assignment.profiles.email,
        subject: `Petljak Lab — Task Reminder: ${status}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #7B3FA0;">PETLJAK LAB</h1>
            <p>Hi ${assignment.profiles.full_name},</p>
            <p>This is a reminder that your assigned checklist is <strong>${status}</strong>.</p>
            <p>Cycle end: ${assignment.cycle_end}</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
              style="display: inline-block; padding: 12px 24px; background: #7B3FA0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Complete Checklist Now
            </a>
          </div>
        `
      });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
