const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Connect to Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Lab Manager API is running' });
});

// ---- TASKS ----

// Get all tasks
app.get('/tasks', async (req, res) => {
  const { data, error } = await supabase.from('tasks').select('*');
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// Create a task
app.post('/tasks', async (req, res) => {
  const { title, assignee_email, due_date, priority, template } = req.body;
  const { data, error } = await supabase.from('tasks').insert([
    { title, assignee_email, due_date, priority, template, status: 'todo' }
  ]);
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// Update a task
app.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id);
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// Delete a task
app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return res.status(500).json({ error });
  res.json({ message: 'Task deleted' });
});

// ---- REMINDERS ----

// Runs every day at 8am
cron.schedule('0 8 * * *', async () => {
  console.log('Running daily reminder check...');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'done');

  for (const task of tasks) {
    const due = task.due_date;

    // Due today
    if (due === today) {
      await sendReminder(task, 'due today');
    }
    // Due tomorrow
    else if (due === tomorrow) {
      await sendReminder(task, 'due tomorrow');
    }
    // Overdue
    else if (due < today) {
      await sendReminder(task, 'overdue');
    }
  }
});

async function sendReminder(task, status) {
  await resend.emails.send({
    from: 'reminders@yourlabdomain.com',
    to: task.assignee_email,
    subject: `Task reminder: ${task.title} is ${status}`,
    html: `
      <h2>Lab Manager Reminder</h2>
      <p>Hi there,</p>
      <p>This is a reminder that your task <strong>${task.title}</strong> is <strong>${status}</strong>.</p>
      <p>Due date: ${task.due_date}</p>
      <p>Priority: ${task.priority}</p>
      <p>Log in to mark it complete or update its status.</p>
    `
  });
  console.log(`Reminder sent to ${task.assignee_email} for task: ${task.title}`);
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));