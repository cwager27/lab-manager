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

router.post('/vacation-request', async (req, res) => {
  const { requestId, memberName, memberEmail, startDate, endDate, leaveType, comments } = req.body;
  try {
    const { data: admins } = await supabase
      .from('profiles').select('email, full_name').eq('role', 'admin');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const approveUrl = `http://localhost:3001/api/vacation-action?id=${requestId}&action=approved`;
    const denyUrl = `http://localhost:3001/api/vacation-action?id=${requestId}&action=denied`;
    const viewUrl = `${frontendUrl}`;

    for (const admin of (admins || [])) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: admin.email,
        subject: `Petljak Lab — Vacation Request from ${memberName}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8f6fb;">
            <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e4f0;">
              <h1 style="color: #7B3FA0; font-size: 20px; margin: 0 0 4px;">PETLJAK LAB</h1>
              <p style="color: #9A9AB0; font-size: 13px; margin: 0 0 24px;">Operations Platform</p>
              <h2 style="font-size: 18px; color: #1A1A2E; margin: 0 0 8px;">New Vacation Request</h2>
              <p style="color: #5A5A7A; font-size: 14px; margin: 0 0 24px;">
                <strong>${memberName}</strong> has requested time off and is awaiting your approval.
              </p>
              <div style="background: #f8f6fb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0; width: 120px;">From</td><td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1A1A2E;">${startDate}</td></tr>
                  <tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0;">To</td><td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1A1A2E;">${endDate}</td></tr>
                  <tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0;">Leave Type</td><td style="padding: 6px 0; font-size: 13px; color: #5A5A7A;">${leaveType}</td></tr>
                  ${comments ? `<tr><td style="padding: 6px 0; font-size: 12px; color: #9A9AB0;">Comments</td><td style="padding: 6px 0; font-size: 13px; color: #5A5A7A; font-style: italic;">${comments}</td></tr>` : ''}
                </table>
              </div>
              <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <a href="${approveUrl}" style="flex: 1; display: inline-block; padding: 12px 24px; background: #27AE60; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center;">Approve</a>
                <a href="${denyUrl}" style="flex: 1; display: inline-block; padding: 12px 24px; background: #E74C3C; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center;">Deny</a>
              </div>
              <a href="${viewUrl}" style="display: block; text-align: center; font-size: 13px; color: #7B3FA0; text-decoration: underline;">
                View in platform to add a comment before deciding
              </a>
            </div>
          </div>
        `
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Vacation request email error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/vacation-action', async (req, res) => {
  const { id, action } = req.query;
  if (!id || !['approved', 'denied'].includes(action)) {
    return res.status(400).send('Invalid request.');
  }
  try {
    const { data: request } = await supabase
      .from('vacation_requests')
      .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name, email)')
      .eq('id', id).single();

    if (!request) return res.status(404).send('Request not found.');
    if (request.status !== 'pending') {
      return res.send(`<html><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f6fb;margin:0;"><div style="background:white;padding:40px;border-radius:12px;text-align:center;max-width:400px;"><h2 style="color:#7B3FA0;">Already Reviewed</h2><p style="color:#5A5A7A;">This request has already been ${request.status}.</p></div></body></html>`);
    }

    await supabase.from('vacation_requests').update({
      status: action, reviewed_at: new Date().toISOString()
    }).eq('id', id);

    await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: request.requester.email,
      subject: `Petljak Lab — Your Vacation Request has been ${action}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
            <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
            <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Vacation Request ${action === 'approved' ? 'Approved' : 'Denied'}</h2>
            <p style="color:#5A5A7A;font-size:14px;margin:0 0 24px;">Hi ${request.requester.full_name}, your time off request for <strong>${request.start_date}</strong> to <strong>${request.end_date}</strong> has been <strong style="color:${action === 'approved' ? '#27AE60' : '#E74C3C'}">${action}</strong>.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in Platform</a>
          </div>
        </div>
      `
    });

    res.send(`<html><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f6fb;margin:0;"><div style="background:white;padding:40px;border-radius:12px;text-align:center;max-width:400px;border:1px solid #e8e4f0;"><h2 style="color:${action === 'approved' ? '#27AE60' : '#E74C3C'};">Request ${action === 'approved' ? 'Approved' : 'Denied'}</h2><p style="color:#5A5A7A;">${request.requester.full_name}'s vacation request has been ${action}. They have been notified.</p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Return to Platform</a></div></body></html>`);
  } catch (error) {
    console.error('Vacation action error:', error);
    res.status(500).send('Something went wrong.');
  }
});

router.post('/vacation-reviewed', async (req, res) => {
  const { memberEmail, memberName, status, startDate, endDate, leaveType, reviewerComment } = req.body;
  try {
    await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: memberEmail,
      subject: `Petljak Lab — Your Vacation Request has been ${status}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
            <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
            <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Vacation Request ${status === 'approved' ? 'Approved' : 'Denied'}</h2>
            <p style="color:#5A5A7A;font-size:14px;margin:0 0 24px;">Hi ${memberName}, your time off request for <strong>${startDate}</strong> to <strong>${endDate}</strong> (${leaveType}) has been <strong style="color:${status === 'approved' ? '#27AE60' : '#E74C3C'}">${status}</strong>.</p>
            ${reviewerComment ? `<div style="background:#f8f6fb;border-radius:8px;padding:16px;margin-bottom:24px;border-left:3px solid #7B3FA0;"><p style="margin:0;font-size:13px;color:#5A5A7A;font-style:italic;">"${reviewerComment}"</p></div>` : ''}
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in Platform</a>
          </div>
        </div>
      `
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Vacation reviewed email error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
