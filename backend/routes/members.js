const express = require('express');
const router = express.Router();
const transporter = { sendMail: async () => {} }; // emails disabled

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

// Create a member immediately with a password — no invite email needed.
// Creates auth user, profile, and lab_contacts row in one shot.
router.post('/members/create', async (req, res) => {
  const { email, password, fullName, role, permissions, contactInfo, createdById, createdByName } = req.body;

  if (!email || !fullName || !role || !password) {
    return res.status(400).json({ error: 'email, fullName, role, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // 1. Create auth user with confirmed email and set password
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) return res.status(400).json({ error: createError.message });
  const userId = userData.user.id;

  // 2. Insert profile row
  const perms = permissions || ROLE_DEFAULTS[role] || ROLE_DEFAULTS.member;
  const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
    id: userId, email, full_name: fullName, role, ...perms,
  }]);
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    return res.status(500).json({ error: 'Profile setup failed: ' + profileError.message });
  }

  // 3. Insert lab_contacts row with all provided contact info
  const nameParts = fullName.trim().split(' ');
  const { error: contactsError } = await supabaseAdmin.from('lab_contacts').insert([{
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    email,
    role: role === 'external' ? 'external' : role,
    status: 'active',
    sort_order: 99,
    title: contactInfo?.title || '',
    personal_email: contactInfo?.personal_email || '',
    phone: contactInfo?.phone || '',
    address: contactInfo?.address || '',
    emergency_contact_name: contactInfo?.emergency_contact_name || '',
    emergency_contact_phone: contactInfo?.emergency_contact_phone || '',
    emergency_contact_email: contactInfo?.emergency_contact_email || '',
    emergency_contact_relationship: contactInfo?.emergency_contact_relationship || '',
  }]);
  if (contactsError) console.error('lab_contacts insert failed:', contactsError.message);

  // 4. Audit log
  const { error: auditError } = await supabaseAdmin.from('auth_audit_log').insert([{
    event_type: 'member_invited',
    actor_id: createdById || null,
    actor_name: createdByName || null,
    target_id: userId,
    target_email: email,
    details: { role, full_name: fullName, method: 'direct_create' },
  }]);
  if (auditError) console.error('audit log failed:', auditError.message);

  res.json({ success: true, userId });
});

router.post('/members/invite', async (req, res) => {
  const { email, fullName, role, permissions, invitedById, invitedByName } = req.body;

  if (!email || !fullName || !role) {
    return res.status(400).json({ error: 'email, fullName, and role are required' });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // 1. Generate invite link — creates the auth user and returns a set-password URL
  //    without sending Supabase's own email (which has a broken apostrophe in the subject).
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: frontendUrl },
  });

  if (inviteError) {
    return res.status(400).json({ error: inviteError.message });
  }

  const userId = inviteData.user.id;
  const inviteLink = inviteData.properties.action_link;

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

  // 4. Send welcome email with the set-password link embedded
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
              Click the button below to set your password and get started.
            </p>
            <div style="background:#f8f6fb;border-radius:8px;padding:20px;margin-bottom:24px;border:1px solid #e8e4f0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;width:120px;">Email</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1A1A2E;">${email}</td></tr>
                <tr><td style="padding:6px 0;font-size:12px;color:#9A9AB0;">Role</td><td style="padding:6px 0;font-size:13px;color:#5A5A7A;">${ROLE_LABELS[role] || role}</td></tr>
              </table>
            </div>
            <a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              Set Your Password
            </a>
            <p style="color:#9A9AB0;font-size:13px;margin-top:20px;margin-bottom:0;">
              This link expires in 24 hours. If you need a new one, contact your lab administrator.
            </p>
            <p style="color:#9A9AB0;font-size:12px;margin-top:16px;">
              Petljak Lab Operations Platform · NYU Langone
            </p>
          </div>
        </div>
      `
    });
  } catch (emailErr) {
    console.error('Welcome email failed:', emailErr.message);
  }

  res.json({ success: true });
});

// ── Reassign future lab meetings when a member is set to alumni ───────────────
router.post('/members/alumni-reassign', async (req, res) => {
  try {
    const { memberId, memberName } = req.body;
    if (!memberId) return res.status(400).json({ error: 'memberId required' });

    const today = new Date().toISOString().split('T')[0];

    const { data: affectedMeetings } = await supabaseAdmin
      .from('lab_meetings')
      .select('*')
      .eq('presenter_id', memberId)
      .eq('status', 'scheduled')
      .gte('meeting_date', today);

    if (!affectedMeetings || affectedMeetings.length === 0) {
      return res.json({ reassigned: 0 });
    }

    const { data: approvedVacations } = await supabaseAdmin
      .from('vacation_requests')
      .select('requested_by, start_date, end_date')
      .eq('status', 'approved');

    const { data: activeMembers } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .neq('id', memberId)
      .in('role', ['admin', 'pm', 'member']);

    const now = new Date();
    const membersWithRatio = (activeMembers || []).map(m => {
      const joinedAt = new Date(m.joined_at || m.created_at);
      const daysAsMember = Math.max(1, Math.ceil((now - joinedAt) / (1000 * 60 * 60 * 24)));
      return { ...m, daysAsMember, ratio: (m.task_counter || 0) / daysAsMember };
    });

    let reassignedCount = 0;
    for (const meeting of affectedMeetings) {
      const available = membersWithRatio.filter(m =>
        !(approvedVacations || []).some(v =>
          v.requested_by === m.id &&
          v.start_date <= meeting.meeting_date &&
          v.end_date >= meeting.meeting_date
        )
      );

      if (available.length === 0) {
        const { data: admins } = await supabaseAdmin.from('profiles').select('email').eq('role', 'admin');
        for (const admin of (admins || [])) {
          await transporter.sendMail({
            from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
            to: admin.email,
            subject: `Petljak Lab — Action Required: No Available Presenter for ${meeting.meeting_date}`,
            html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;"><div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;"><h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1><h2 style="font-size:18px;color:#E74C3C;margin:0 0 8px;">Action Required</h2><p style="color:#5A5A7A;font-size:14px;margin:0 0 24px;">${memberName} has moved to alumni status but was scheduled to present on ${meeting.meeting_date}. No other lab members are available. Please manually assign a presenter.</p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Go to Platform</a></div></div>`
          });
        }
        continue;
      }

      available.sort((a, b) => a.ratio - b.ratio);
      const newPresenter = available[0];
      newPresenter.task_counter = (newPresenter.task_counter || 0) + 1;
      newPresenter.ratio = newPresenter.task_counter / newPresenter.daysAsMember;

      const token = require('crypto').randomBytes(16).toString('hex');
      await supabaseAdmin.from('lab_meetings').update({
        presenter_id: newPresenter.id,
        confirmation_status: 'pending',
        confirmation_token: token,
        reminder_count: 0,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', meeting.id);

      const confirmUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/confirm-presenter?token=${token}`;
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: newPresenter.email,
        subject: `Petljak Lab — You are now presenting at the ${meeting.meeting_date} meeting — Please Confirm`,
        html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;"><div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;"><h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1><h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">You Have Been Assigned to Present</h2><p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">${memberName} has moved to alumni status, so you have been assigned to present at the <strong>${meeting.meeting_date}</strong> lab meeting.</p><p style="color:#5A5A7A;font-size:13px;margin:0 0 24px;">Thursdays 1:30–3pm · Zoom: 987 7040 0275 · Passcode: 676073</p><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#27AE60;color:white;text-decoration:none;border-radius:8px;font-weight:600;margin-right:10px;">Confirm I'm Aware</a><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Schedule</a></div></div>`
      });

      reassignedCount++;
    }

    res.json({ reassigned: reassignedCount, total: affectedMeetings.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
