const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function getAllLabEmails() {
  const { data } = await supabase.from('profiles').select('email, full_name');
  return data || [];
}

// Presenter changed
router.post('/meeting-presenter-changed', async (req, res) => {
  const { meetingId, meetingDate, oldPresenterEmail, oldPresenterName, newPresenterEmail, newPresenterName, changedByName } = req.body;
  try {
    if (oldPresenterEmail) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: oldPresenterEmail,
        subject: `Petljak Lab — You have been removed from the ${meetingDate} meeting`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Presentation Reassigned</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">Hi ${oldPresenterName}, you have been removed as presenter for the <strong>${meetingDate}</strong> lab meeting by ${changedByName}.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Schedule</a>
            </div>
          </div>
        `
      });
    }

    if (newPresenterEmail && meetingId) {
      // Generate confirmation token and set status to pending
      const token = require('crypto').randomBytes(16).toString('hex');
      await supabase.from('lab_meetings').update({
        confirmation_status: 'pending',
        confirmation_token: token,
        reminder_count: 0,
        last_reminder_at: new Date().toISOString()
      }).eq('id', meetingId);

      const confirmUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/confirm-presenter?token=${token}`;

      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: newPresenterEmail,
        subject: `Petljak Lab — You are presenting at the ${meetingDate} meeting — Please Confirm`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">You Have Been Assigned to Present</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">Hi ${newPresenterName}, you have been assigned to present at the <strong>${meetingDate}</strong> lab meeting by ${changedByName}.</p>
              <p style="color:#5A5A7A;font-size:13px;margin:0 0 24px;">Thursdays 1:30–3pm · Zoom: 987 7040 0275 · Passcode: 676073</p>
              <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#27AE60;color:white;text-decoration:none;border-radius:8px;font-weight:600;margin-right:10px;">Confirm I'm Aware</a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Schedule</a>
            </div>
          </div>
        `
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Meeting presenter changed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm presenter awareness
router.get('/confirm-presenter', async (req, res) => {
  const { token } = req.query;
  try {
    const { data: meeting } = await supabase
      .from('lab_meetings').select('*').eq('confirmation_token', token).single();

    if (!meeting) {
      return res.send(`<html><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f6fb;margin:0;"><div style="background:white;padding:40px;border-radius:12px;text-align:center;max-width:400px;"><h2 style="color:#E74C3C;">Invalid or Expired Link</h2></div></body></html>`);
    }

    await supabase.from('lab_meetings').update({
      confirmation_status: 'confirmed',
      confirmation_token: null
    }).eq('id', meeting.id);

    res.send(`<html><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f6fb;margin:0;"><div style="background:white;padding:40px;border-radius:12px;text-align:center;max-width:400px;border:1px solid #e8e4f0;"><h2 style="color:#27AE60;">Confirmed!</h2><p style="color:#5A5A7A;">Thanks for confirming you're presenting on ${meeting.meeting_date}.</p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Return to Platform</a></div></body></html>`);
  } catch (error) {
    console.error('Confirm presenter error:', error);
    res.status(500).send('Something went wrong.');
  }
});

// Daily reminder check for unconfirmed presenters (called from cron)
async function checkPendingConfirmations() {
  const { data: pendingMeetings } = await supabase
    .from('lab_meetings')
    .select('*')
    .eq('confirmation_status', 'pending');

  if (!pendingMeetings || pendingMeetings.length === 0) return;

  const { data: managers } = await supabase
    .from('profiles').select('email, full_name').in('role', ['admin', 'pm']);

  for (const meeting of pendingMeetings) {
    const newCount = (meeting.reminder_count || 0) + 1;
    const confirmUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/confirm-presenter?token=${meeting.confirmation_token}`;

    // Find presenter email
    const { data: presenterProfile } = await supabase
      .from('profiles').select('email, full_name').eq('id', meeting.presenter_id).single();

    if (presenterProfile?.email) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: presenterProfile.email,
        subject: `Petljak Lab — Reminder: Please confirm presenting on ${meeting.date}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Reminder: Confirm Presentation</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">You're scheduled to present on <strong>${meeting.date}</strong> but haven't confirmed yet.</p>
              <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#27AE60;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Confirm I'm Aware</a>
            </div>
          </div>
        `
      });
    }

    await supabase.from('lab_meetings').update({
      reminder_count: newCount,
      last_reminder_at: new Date().toISOString()
    }).eq('id', meeting.id);

    // Escalate to Mia/PM after 3 reminders
    if (newCount >= 3) {
      for (const manager of (managers || [])) {
        await transporter.sendMail({
          from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
          to: manager.email,
          subject: `Petljak Lab — Escalation: ${meeting.presenter} hasn't confirmed presenting on ${meeting.date}`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
              <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
                <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
                <h2 style="font-size:18px;color:#E74C3C;margin:0 0 8px;">Escalation: Unconfirmed Presenter</h2>
               <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;"><strong>${presenterProfile?.full_name}</strong> has not confirmed they're presenting on <strong>${meeting.meeting_date}</strong> after 3 reminders.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Schedule</a>
              </div>
            </div>
          `
        });
      }
    }
  }
}

// Meeting cancelled — email whole lab
router.post('/meeting-cancelled', async (req, res) => {
  const { meetingDate, cancelledByName } = req.body;
  try {
    const labMembers = await getAllLabEmails();
    for (const member of labMembers) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: member.email,
        subject: `Petljak Lab — Meeting Cancelled: ${meetingDate}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Meeting Cancelled</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">Hi ${member.full_name}, the lab meeting scheduled for <strong>${meetingDate}</strong> has been cancelled by ${cancelledByName}.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Schedule</a>
            </div>
          </div>
        `
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Meeting cancelled error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Meeting added — email whole lab
router.post('/meeting-added', async (req, res) => {
  const { meetingDate, presenterName, isSof, addedByName } = req.body;
  try {
    const labMembers = await getAllLabEmails();
    for (const member of labMembers) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: member.email,
        subject: `Petljak Lab — New Meeting Added: ${meetingDate}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">New Meeting Added</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 24px;">Hi ${member.full_name}, a new lab meeting has been added by ${addedByName}.</p>
              <div style="background:#f8f6fb;border-radius:8px;padding:20px;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;width:120px;">Date</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${meetingDate}</td></tr>
                  <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;">Presenter</td><td style="padding:6px 0;font-size:13px;color:#5A5A7A;">${presenterName}</td></tr>
                  <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;">Type</td><td style="padding:6px 0;font-size:13px;color:#5A5A7A;">${isSof ? 'State of the Field (SOF)' : 'Regular Lab Meeting'}</td></tr>
                  <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;">Time</td><td style="padding:6px 0;font-size:13px;color:#5A5A7A;">Thursdays 1:30–3pm</td></tr>
                </table>
              </div>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Schedule</a>
            </div>
          </div>
        `
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Meeting added error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, checkPendingConfirmations };
