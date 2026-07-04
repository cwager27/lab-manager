const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});
transporter.sendMail = async () => {}; // paused

const ROLE_LABELS = { admin: 'Supervisor', pm: 'Program Manager', member: 'Lab Member', intern: 'Intern' };

const ROLE_DEFAULTS = {
  admin:  { can_assign_tasks: true,  can_approve_sporadic: true,  can_edit_meetings: true,  can_view_finance: true,  can_edit_samples: true,  can_view_contacts: true,  can_add_members: true  },
  pm:     { can_assign_tasks: true,  can_approve_sporadic: true,  can_edit_meetings: false, can_view_finance: true,  can_edit_samples: true,  can_view_contacts: true,  can_add_members: true  },
  member: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: true,  can_edit_samples: true,  can_view_contacts: false, can_add_members: false },
  intern: { can_assign_tasks: false, can_approve_sporadic: false, can_edit_meetings: false, can_view_finance: false, can_edit_samples: true,  can_view_contacts: false, can_add_members: false },
};

// Check whether a member has completed onboarding (has a lab_contacts entry with personal info).
router.get('/members/onboarding-status', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
  if (!prof) return res.json({ complete: false });

  let entry = null;
  if (prof.email) {
    const { data } = await supabaseAdmin.from('lab_contacts').select('id').ilike('email', prof.email).maybeSingle();
    entry = data;
  }
  if (!entry && prof.full_name) {
    const { data } = await supabaseAdmin.from('lab_contacts').select('id').ilike('full_name', prof.full_name).maybeSingle();
    entry = data;
  }

  res.json({ complete: !!entry });
});

// Save personal info collected during onboarding. Creates or updates the lab_contacts entry.
router.post('/members/onboarding', async (req, res) => {
  const { userId, phone, address, emergency_contact_name, emergency_contact_phone, emergency_contact_email, emergency_contact_relationship } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
  if (!prof) return res.status(404).json({ error: 'Profile not found' });

  const payload = { phone, address, emergency_contact_name, emergency_contact_phone, emergency_contact_email, emergency_contact_relationship, updated_at: new Date().toISOString() };

  let updated = false;

  if (prof.email) {
    const { data: existing } = await supabaseAdmin.from('lab_contacts').select('id').ilike('email', prof.email).maybeSingle();
    if (existing) {
      await supabaseAdmin.from('lab_contacts').update(payload).eq('id', existing.id);
      updated = true;
    }
  }
  if (!updated && prof.full_name) {
    const { data: existing } = await supabaseAdmin.from('lab_contacts').select('id').ilike('full_name', prof.full_name).maybeSingle();
    if (existing) {
      await supabaseAdmin.from('lab_contacts').update(payload).eq('id', existing.id);
      updated = true;
    }
  }
  if (!updated) {
    const nameParts = (prof.full_name || '').trim().split(' ');
    await supabaseAdmin.from('lab_contacts').insert([{
      ...payload,
      email: prof.email || '',
      full_name: prof.full_name || '',
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      role: 'member',
      status: 'active',
      sort_order: 99,
    }]);
  }

  res.json({ success: true });
});

router.post('/members/invite', async (req, res) => {
  const { email, fullName, role, permissions, invitedById, invitedByName } = req.body;

  if (!email || !fullName || !role) {
    return res.status(400).json({ error: 'email, fullName, and role are required' });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // 1. Create pending auth user — Supabase sends the invite email with the set-password link
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: frontendUrl }
  );

  if (inviteError) {
    return res.status(400).json({ error: inviteError.message });
  }

  const userId = inviteData.user.id;

  // 2. Insert profile row now that we have the auth user ID
  const perms = permissions || ROLE_DEFAULTS[role] || ROLE_DEFAULTS.member;
  const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
    id: userId,
    email,
    full_name: fullName,
    role,
    ...perms,
  }]);

  if (profileError) {
    console.error('Profile insert failed after invite:', profileError.message);
    return res.status(500).json({ error: 'Invite sent but profile setup failed. Contact support.' });
  }

  // 3. Audit log
  await supabaseAdmin.from('auth_audit_log').insert([{
    event_type:   'member_invited',
    actor_id:     invitedById   || null,
    actor_name:   invitedByName || null,
    target_id:    userId,
    target_email: email,
    details:      { role, full_name: fullName },
  }]).catch(err => console.error('audit log failed:', err.message));

  // 4. Send companion welcome email explaining the invite flow
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
              You have been added to the Petljak Lab Operations Platform as a
              <strong>${ROLE_LABELS[role] || role}</strong>.
            </p>
            <div style="background:#f8f6fb;border-radius:8px;padding:20px;margin-bottom:24px;border:1px solid #e8e4f0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;width:120px;">Email</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${email}</td></tr>
                <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;">Role</td><td style="padding:6px 0;font-size:13px;color:#5A5A7A;">${ROLE_LABELS[role] || role}</td></tr>
              </table>
            </div>
            <p style="color:#5A5A7A;font-size:14px;margin:0 0 8px;">
              Check your inbox for a separate email with a secure link to set your password.
              The link expires in 24 hours.
            </p>
            <p style="color:#9A9AB0;font-size:13px;margin:0 0 24px;">
              If you don't see it within a few minutes, check your spam folder or ask your lab administrator to resend the invite.
            </p>
            <a href="${frontendUrl}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              Go to Platform
            </a>
            <p style="color:#9A9AB0;font-size:12px;margin-top:24px;">
              Petljak Lab Operations Platform · NYU Langone
            </p>
          </div>
        </div>
      `
    });
  } catch (emailErr) {
    // Non-fatal: auth invite was sent and profile created. Log and continue.
    console.error('Companion welcome email failed:', emailErr.message);
  }

  res.json({ success: true });
});

module.exports = router;
