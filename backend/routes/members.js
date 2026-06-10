const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

router.post('/welcome-email', async (req, res) => {
  const { email, fullName, password, role } = req.body;
  const roleLabels = { admin: 'Supervisor', pm: 'Program Manager', member: 'Lab Member', intern: 'Intern' };
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Welcome to the Petljak Lab Operations Platform`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
            <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 4px;">PETLJAK LAB</h1>
            <p style="color:#9A9AB0;font-size:13px;margin:0 0 24px;">Operations Platform</p>
            <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Welcome, ${fullName}!</h2>
            <p style="color:#5A5A7A;font-size:14px;margin:0 0 24px;">
              You have been added to the Petljak Lab Operations Platform as a <strong>${roleLabels[role] || role}</strong>. 
              Here are your login credentials:
            </p>
            <div style="background:#f8f6fb;border-radius:8px;padding:20px;margin-bottom:24px;border:1px solid #e8e4f0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;width:120px;">Email</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${email}</td></tr>
                <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;">Password</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${password}</td></tr>
                <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;">Role</td><td style="padding:6px 0;font-size:13px;color:#5A5A7A;">${roleLabels[role] || role}</td></tr>
              </table>
            </div>
            <p style="color:#E74C3C;font-size:13px;margin:0 0 24px;">
              Please change your password after your first login for security.
            </p>
            <a href="${frontendUrl}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              Log In Now
            </a>
            <p style="color:#9A9AB0;font-size:12px;margin-top:24px;">
              Petljak Lab Operations Platform · NYU Langone
            </p>
          </div>
        </div>
      `
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
