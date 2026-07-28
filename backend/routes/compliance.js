const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const transporter = { sendMail: async () => {} }; // emails disabled

// Check certificate expiries (called from cron)
async function checkCertificateExpiries() {
  const { data: studies } = await supabase.from('compliance_studies').select('*');
  if (!studies || studies.length === 0) return;

  const { data: managers } = await supabase
    .from('profiles').select('email, full_name').in('role', ['admin', 'pm']);

  const today = new Date();

  for (const study of studies) {
    if (!study.certificate_expiry) continue;

    const expiryDate = new Date(study.certificate_expiry);
    const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    // Determine if we should send a reminder
    let shouldSend = false;
    if (daysLeft === 60) shouldSend = true; // 2 months before
    else if (daysLeft <= 30 && daysLeft >= 0) {
      // Weekly reminders in the final month
      if (!study.last_reminder_sent) {
        shouldSend = true;
      } else {
        const lastSent = new Date(study.last_reminder_sent);
        const daysSinceLastReminder = Math.ceil((today - lastSent) / (1000 * 60 * 60 * 24));
        if (daysSinceLastReminder >= 7) shouldSend = true;
      }
    } else if (daysLeft < 0) {
      // Past expiry — keep sending weekly
      if (!study.last_reminder_sent) {
        shouldSend = true;
      } else {
        const lastSent = new Date(study.last_reminder_sent);
        const daysSinceLastReminder = Math.ceil((today - lastSent) / (1000 * 60 * 60 * 24));
        if (daysSinceLastReminder >= 7) shouldSend = true;
      }
    }

    if (!shouldSend) continue;

    // Get team member emails
    const { data: teamMembers } = await supabase
      .from('profiles').select('email, full_name').in('id', study.team_members || []);

    const recipients = new Set();
    (teamMembers || []).forEach(m => recipients.add(m.email));
    (managers || []).forEach(m => recipients.add(m.email));

    const urgencyText = daysLeft < 0
      ? `expired ${Math.abs(daysLeft)} day(s) ago`
      : `expires in ${daysLeft} day(s)`;
    const urgencyColor = daysLeft < 0 ? '#E74C3C' : daysLeft <= 30 ? '#F39C12' : '#2980B9';

    for (const email of recipients) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Petljak Lab — Certificate ${daysLeft < 0 ? 'EXPIRED' : 'Expiring'}: ${study.study_name}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:${urgencyColor};margin:0 0 8px;">Certificate ${daysLeft < 0 ? 'Expired' : 'Expiring Soon'}</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">The certificate for study <strong>${study.study_name}</strong> ${urgencyText} (${study.certificate_expiry}).</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View in Platform</a>
            </div>
          </div>
        `
      });
    }

    await supabase.from('compliance_studies').update({
      last_reminder_sent: today.toISOString().split('T')[0],
      reminder_count: (study.reminder_count || 0) + 1
    }).eq('id', study.id);

    // Create sporadic task for PM/admin at 2-month mark (only once)
    if (daysLeft === 60) {
      // Check if task already exists for this study
      const taskTitle = `Renew compliance certificate: ${study.study_name} — expires ${study.certificate_expiry}`;
      const { data: existingTask } = await supabase
        .from('sporadic_tasks')
        .select('id')
        .eq('title', taskTitle)
        .neq('status', 'submitted')
        .single();

      if (!existingTask) {
        // Assign to admin
        const { data: admin } = await supabase
          .from('profiles').select('id').eq('role', 'admin').single();

        await supabase.from('sporadic_tasks').insert([{
          title: taskTitle,
          description: `The compliance certificate for study "${study.study_name}" expires on ${study.certificate_expiry}. Please renew and upload the new certificate in the Compliance → Studies tab.`,
          category: 'PM',
          assigned_to: admin?.id,
          assigned_by: admin?.id,
          due_date: study.certificate_expiry,
          status: 'pending',
          response_type: 'checkbox'
        }]);
      }
    }
  }
}

router.get('/check-certificate-expiries', async (req, res) => {
  await checkCertificateExpiries();
  res.json({ success: true });
});

async function checkPolicyReminders() {
  const { data: policies } = await supabase.from('lab_policies').select('*');
  if (!policies || policies.length === 0) return;

  const { data: managers } = await supabase
    .from('profiles').select('email, full_name').in('role', ['admin', 'pm']);

  const today = new Date();

  for (const policy of policies) {
    if (!policy.review_date) continue;

    const reviewDate = new Date(policy.review_date);
    const daysLeft = Math.ceil((reviewDate - today) / (1000 * 60 * 60 * 24));

    let shouldSend = false;
    if (daysLeft === 30) shouldSend = true; // 1 month before
    else if (daysLeft <= 7 && daysLeft >= 0) {
      if (!policy.last_reminder_sent) {
        shouldSend = true;
      } else {
        const lastSent = new Date(policy.last_reminder_sent);
        const daysSince = Math.ceil((today - lastSent) / (1000 * 60 * 60 * 24));
        if (daysSince >= 7) shouldSend = true;
      }
    } else if (daysLeft < 0) {
      if (!policy.last_reminder_sent) {
        shouldSend = true;
      } else {
        const lastSent = new Date(policy.last_reminder_sent);
        const daysSince = Math.ceil((today - lastSent) / (1000 * 60 * 60 * 24));
        if (daysSince >= 7) shouldSend = true;
      }
    }

    if (!shouldSend) continue;

    const urgencyText = daysLeft < 0
      ? `was due ${Math.abs(daysLeft)} day(s) ago`
      : `is due in ${daysLeft} day(s)`;
    const urgencyColor = daysLeft < 0 ? '#E74C3C' : daysLeft <= 7 ? '#F39C12' : '#2980B9';

    for (const manager of (managers || [])) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: manager.email,
        subject: `Petljak Lab — Policy Review ${daysLeft < 0 ? 'OVERDUE' : 'Due'}: ${policy.title}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:${urgencyColor};margin:0 0 8px;">Policy Review ${daysLeft < 0 ? 'Overdue' : 'Due Soon'}</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">The policy <strong>${policy.title}</strong> ${urgencyText} (${policy.review_date}).</p>
              ${policy.category ? `<p style="color:#5A5A7A;font-size:13px;margin:0 0 24px;">Category: ${policy.category}</p>` : ''}
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Review in Platform</a>
            </div>
          </div>
        `
      });
    }

    await supabase.from('lab_policies').update({
      last_reminder_sent: today.toISOString().split('T')[0],
      reminder_count: (policy.reminder_count || 0) + 1
    }).eq('id', policy.id);
  }
}

router.get('/check-policy-reminders', async (req, res) => {
  await checkPolicyReminders();
  res.json({ success: true });
});

module.exports = { router, checkCertificateExpiries, checkPolicyReminders };
