const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const transporter = require('../lib/mailer');

router.post('/send-assignments', async (req, res) => {
  const { assignments, cycleStart, cycleEnd } = req.body;

  if (!assignments || assignments.length === 0) {
    return res.status(400).json({ error: 'No assignments provided' });
  }

  try {
    const byMember = {};
    for (const a of assignments) {
      if (!byMember[a.memberId]) {
        byMember[a.memberId] = {
          memberEmail: a.memberEmail,
          memberName: a.memberName,
          tasks: []
        };
      }
      byMember[a.memberId].tasks.push(a.taskTitle);
    }

    for (const memberId of Object.keys(byMember)) {
      const { memberEmail, memberName, tasks } = byMember[memberId];
      const taskList = tasks.map(t => `<li style="margin-bottom:8px;">${t}</li>`).join('');

      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: memberEmail,
        subject: `Petljak Lab — New Tasks Assigned (${cycleStart})`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8f6fb;">
            <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e4f0;">
              <div style="margin-bottom: 24px;">
                <h1 style="color: #7B3FA0; font-size: 20px; margin: 0 0 4px;">PETLJAK LAB</h1>
                <p style="color: #9A9AB0; font-size: 13px; margin: 0;">Operations Platform</p>
              </div>
              <h2 style="font-size: 18px; color: #1A1A2E; margin: 0 0 8px;">New Tasks Assigned</h2>
              <p style="color: #5A5A7A; font-size: 14px; margin: 0 0 24px;">
                Hi ${memberName}, you have been assigned the following tasks for the cycle starting <strong>${cycleStart}</strong>.
              </p>
              <div style="background: #f8f6fb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <ul style="margin: 0; padding-left: 20px; color: #1A1A2E; font-size: 14px; line-height: 1.6;">
                  ${taskList}
                </ul>
              </div>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
                style="display: inline-block; padding: 12px 24px; background: #7B3FA0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Complete Checklist Now
              </a>
              <p style="color: #9A9AB0; font-size: 12px; margin-top: 24px;">
                Cycle: ${cycleStart} to ${cycleEnd}<br/>
                Petljak Lab Operations Platform
              </p>
            </div>
          </div>
        `
      });
    }

    res.json({ success: true, emailsSent: Object.keys(byMember).length });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
