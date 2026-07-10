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
transporter.sendMail = async () => {}; // paused

router.post('/submit-checklist', async (req, res) => {
  const { assignmentId, responses, submittedBy, submittedByName, cycleStart } = req.body;
  console.log('Submit checklist received from:', submittedByName);

  try {
    if (assignmentId) {
      await supabase
        .from('task_assignments')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', assignmentId);
    }

    for (const response of responses) {
      await supabase.from('task_responses').insert([{
        assignment_id: assignmentId || null,
        task_definition_id: response.taskId,
        response: response.response,
        notes: response.notes || null,
        conditional_response: response.conditionalResponse || null,
        photo_url: response.photoUrl || null,
        sop_photo_url: response.sopPhotoUrl || null,
      }]);
    }

    await supabase.from('task_archives').insert([{
      assignment_id: assignmentId || null,
      archived_data: { responses, submittedBy, submittedByName, cycleStart },
    }]);

    const { data: managers, error: managerError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .in('role', ['admin', 'pm']);

    console.log('Managers found:', managers);
    if (managerError) console.error('Manager fetch error:', managerError);

    const yesCount = responses.filter(r => r.response === 'yes' || r.response === 'checked').length;
    const noCount = responses.filter(r => r.response === 'no').length;
    const totalCount = responses.length;

    const responseRows = responses.map(r => `
      <tr style="border-bottom: 1px solid #e8e4f0;">
        <td style="padding: 10px 12px; font-size: 13px; color: #1A1A2E;">
          ${r.taskTitle}
          ${r.notes ? `<div style="font-size: 11px; color: #9A9AB0; margin-top: 3px;">Note: ${r.notes}</div>` : ''}
        </td>
        <td style="padding: 10px 12px; text-align: center;">
          <span style="padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
            background: ${r.response === 'yes' || r.response === 'checked' ? '#EAF7F0' : r.response === 'no' ? '#FEF0F0' : '#F5F5F5'};
            color: ${r.response === 'yes' || r.response === 'checked' ? '#27AE60' : r.response === 'no' ? '#E74C3C' : '#9A9AB0'};">
            ${r.response === 'yes' ? 'Yes' : r.response === 'no' ? 'No' : r.response === 'checked' ? 'Done' : 'N/A'}
          </span>
        </td>
      </tr>
    `).join('');

    for (const manager of (managers || [])) {
      console.log('Sending email to:', manager.email);
      try {
        await transporter.sendMail({
          from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
          to: manager.email,
          subject: `Petljak Lab — Checklist Submitted by ${submittedByName}`,
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f8f6fb;">
              <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e4f0;">
                <h1 style="color: #7B3FA0; font-size: 20px; margin: 0 0 4px;">PETLJAK LAB</h1>
                <h2 style="font-size: 18px; color: #1A1A2E; margin: 24px 0 8px;">Checklist Submitted</h2>
                <p style="color: #5A5A7A; font-size: 14px; margin: 0 0 24px;">
                  <strong>${submittedByName}</strong> submitted their checklist for cycle starting <strong>${cycleStart}</strong>.
                </p>
                <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                  <div style="flex: 1; background: #EAF7F0; border-radius: 8px; padding: 16px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #27AE60;">${yesCount}</div>
                    <div style="font-size: 12px; color: #27AE60;">Completed</div>
                  </div>
                  <div style="flex: 1; background: #FEF0F0; border-radius: 8px; padding: 16px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #E74C3C;">${noCount}</div>
                    <div style="font-size: 12px; color: #E74C3C;">Issues Found</div>
                  </div>
                  <div style="flex: 1; background: #F5EEF8; border-radius: 8px; padding: 16px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #7B3FA0;">${totalCount}</div>
                    <div style="font-size: 12px; color: #7B3FA0;">Total Tasks</div>
                  </div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f8f6fb;">
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #9A9AB0; text-transform: uppercase;">Task</th>
                      <th style="padding: 10px 12px; text-align: center; font-size: 11px; color: #9A9AB0; text-transform: uppercase;">Response</th>
                    </tr>
                  </thead>
                  <tbody>${responseRows}</tbody>
                </table>
              </div>
            </div>
          `
        });
        console.log('Email sent successfully to:', manager.email);
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/sop-alert', async (req, res) => {
  const { taskTitle, note, photoUrl, submittedByName, submittedByEmail } = req.body;
  try {
    const { data: managers } = await supabase
      .from('profiles').select('email, full_name').in('role', ['admin', 'pm']);

    for (const manager of (managers || [])) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: manager.email,
        subject: `Petljak Lab — SOP Exception Submitted by ${submittedByName}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e8e4f0;">
              <h1 style="color: #7B3FA0;">PETLJAK LAB</h1>
              <h2 style="color: #1A1A2E;">SOP Exception Documented</h2>
              <p style="color: #5A5A7A;"><strong>${submittedByName}</strong> marked <strong>"${taskTitle}"</strong> as <span style="color:#e74c3c;font-weight:700;">No</span> and documented the exception.</p>
              ${note ? `<div style="margin: 16px 0; padding: 12px 16px; background: #FFF8F0; border-left: 4px solid #E67E22; border-radius: 4px;"><p style="margin:0; color:#5A5A7A; font-size:14px;"><strong>Corrective action:</strong><br/>${note}</p></div>` : ''}
              ${photoUrl ? `<p style="color:#5A5A7A; font-size:13px; margin-top:16px;"><strong>Documentation photo:</strong></p><img src="${photoUrl}" style="width:100%; border-radius:8px; margin-top:8px;" />` : '<p style="color:#9A9AB0; font-size:12px; margin-top:16px;">No photo attached.</p>'}
              <p style="color: #9A9AB0; font-size: 12px; margin-top: 16px;">Submitted by: ${submittedByName} (${submittedByEmail})</p>
            </div>
          </div>
        `
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('SOP alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
