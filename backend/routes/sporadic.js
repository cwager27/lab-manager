const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const transporter = require('../lib/mailer');

// Send assignment email
router.post('/send-sporadic-assignment', async (req, res) => {
  const { taskTitle, taskDescription, category, dueDate, memberEmail, memberName, assignedByName } = req.body;
  console.log('Sending sporadic assignment to:', memberEmail);

  try {
    await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: memberEmail,
      subject: `Petljak Lab — New Task Assigned: ${taskTitle}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8f6fb;">
          <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e4f0;">
            <h1 style="color: #7B3FA0; font-size: 20px; margin: 0 0 4px;">PETLJAK LAB</h1>
            <p style="color: #9A9AB0; font-size: 13px; margin: 0 0 24px;">Operations Platform</p>
            <h2 style="font-size: 18px; color: #1A1A2E; margin: 0 0 8px;">New Task Assigned</h2>
            <p style="color: #5A5A7A; font-size: 14px; margin: 0 0 24px;">
              Hi ${memberName}, <strong>${assignedByName}</strong> has assigned you a new task.
            </p>
            <div style="background: #f8f6fb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0; width: 100px;">Task</td><td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1A1A2E;">${taskTitle}</td></tr>
                ${taskDescription ? `<tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0;">Details</td><td style="padding: 6px 0; font-size: 13px; color: #5A5A7A;">${taskDescription}</td></tr>` : ''}
                <tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0;">Category</td><td style="padding: 6px 0; font-size: 13px; color: #5A5A7A;">${category}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0;">Due Date</td><td style="padding: 6px 0; font-size: 13px; color: #E74C3C; font-weight: 600;">${dueDate}</td></tr>
              </table>
            </div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
              style="display: inline-block; padding: 12px 24px; background: #7B3FA0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Complete Task Now
            </a>
          </div>
        </div>
      `
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Sporadic assignment email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notify PM when task submitted
router.post('/sporadic-submitted', async (req, res) => {
  const { taskTitle, memberName, response, assignedByName } = req.body;

  try {
    const { data: managers } = await supabase
      .from('profiles').select('email, full_name').in('role', ['admin', 'pm']);

    for (const manager of (managers || [])) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: manager.email,
        subject: `Petljak Lab — Task Completed: ${taskTitle}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8f6fb;">
            <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e4f0;">
              <h1 style="color: #7B3FA0; font-size: 20px; margin: 0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size: 18px; color: #1A1A2E; margin: 0 0 8px;">Task Completed</h2>
              <p style="color: #5A5A7A; font-size: 14px; margin: 0 0 24px;">
                <strong>${memberName}</strong> has completed the task <strong>${taskTitle}</strong>.
              </p>
              <div style="background: #EAF7F0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #27AE60;">
                  Response: <strong>${response}</strong>
                </p>
              </div>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
                style="display: inline-block; padding: 12px 24px; background: #7B3FA0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                View in Platform
              </a>
            </div>
          </div>
        `
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Sporadic submitted email error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
