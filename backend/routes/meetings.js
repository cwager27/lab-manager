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
  const { meetingDate, oldPresenterEmail, oldPresenterName, newPresenterEmail, newPresenterName, changedByName } = req.body;
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

    if (newPresenterEmail) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: newPresenterEmail,
        subject: `Petljak Lab — You are presenting at the ${meetingDate} meeting`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">You Have Been Assigned to Present</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">Hi ${newPresenterName}, you have been assigned to present at the <strong>${meetingDate}</strong> lab meeting by ${changedByName}.</p>
              <p style="color:#5A5A7A;font-size:13px;margin:0 0 24px;">Thursdays 1:30–3pm · Zoom: 987 7040 0275 · Passcode: 676073</p>
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

module.exports = router;
