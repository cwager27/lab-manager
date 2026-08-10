const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const ALLOWED_TYPES = new Set([
  'member_invited',
  'member_removed',
  'role_changed',
  'password_reset_requested',
  'failed_login',
]);

// Admin-only: set a member's password without invalidating their active sessions.
// Existing JWTs remain valid until expiry; new logins require the updated password.
router.post('/auth/change-member-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('change-member-password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Returns whether an email address has a registered profile.
// Used by the forgot-password form to block resets for unknown emails
// without exposing auth.users directly (which requires service role).
router.post('/auth/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email required' });
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle();
  if (error) {
    console.error('check-email error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ exists: !!data });
});

// Delete a lab member: reassigns future meetings by workload ratio, unassigns tasks, removes profile + auth user.
router.delete('/auth/members/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Reassign future scheduled meetings to the next scheduled presenter in the sequence
    {
      const { data: allFutureMeetings } = await supabaseAdmin
        .from('lab_meetings')
        .select('id, meeting_date, presenter_id')
        .eq('status', 'scheduled')
        .gte('meeting_date', today)
        .order('meeting_date');

      const allMeetings = allFutureMeetings || [];

      for (const meeting of allMeetings) {
        if (meeting.presenter_id !== id) continue;

        // Find the presenter of the next scheduled meeting that belongs to someone else
        const next = allMeetings.find(m =>
          m.meeting_date > meeting.meeting_date && m.presenter_id && m.presenter_id !== id
        );

        const newPresenterId = next?.presenter_id || null;
        const token = require('crypto').randomBytes(16).toString('hex');

        await supabaseAdmin.from('lab_meetings').update({
          presenter_id: newPresenterId,
          confirmation_status: newPresenterId ? 'pending' : null,
          confirmation_token: newPresenterId ? token : null,
          reminder_count: 0,
          last_reminder_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', meeting.id);
      }
    }

    // 2. Unassign recurring task assignments
    await supabaseAdmin.from('task_assignments').update({ assigned_to: null }).eq('assigned_to', id);

    // 3. Unassign sporadic tasks
    await supabaseAdmin.from('sporadic_tasks').update({ assigned_to: null }).eq('assigned_to', id);

    // 4. Unassign task occurrences
    await supabaseAdmin.from('task_occurrences').update({ assigned_to: null, status: 'unassigned' }).eq('assigned_to', id).gte('due_date', today).neq('status', 'done');

    // 5. Delete vacation requests (FK blocks auth user deletion if left)
    await supabaseAdmin.from('vacation_requests').delete().eq('requested_by', id);

    // 6. Null out task reassignment records referencing this user
    await supabaseAdmin.from('task_reassignments').update({ original_assignee_id: null }).eq('original_assignee_id', id);

    // 7. Null out compliance studies assigned to this user
    await supabaseAdmin.from('compliance_studies').update({ assigned_to: null }).eq('assigned_to', id);

    // 9. Delete their lab_contacts entry — match by both email AND name to avoid wiping other contacts
    const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', id).maybeSingle();
    if (prof?.email && prof?.full_name) {
      const nameParts = prof.full_name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      await supabaseAdmin.from('lab_contacts').delete()
        .ilike('email', prof.email)
        .ilike('first_name', firstName)
        .ilike('last_name', lastName);
    }

    // 10. Delete auth user (cascades to profiles row via FK)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (err) {
    console.error('member delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Called by the frontend for events it witnesses.
// Uses service role so it works for both authenticated (role changes)
// and unauthenticated (failed logins, reset requests) callers.
router.post('/auth/log-event', async (req, res) => {
  const { event_type, actor_id, actor_name, target_id, target_email, details } = req.body;

  if (!event_type || !ALLOWED_TYPES.has(event_type)) {
    return res.status(400).json({ error: 'invalid event_type' });
  }

  const { error } = await supabaseAdmin.from('auth_audit_log').insert([{
    event_type,
    actor_id:    actor_id    || null,
    actor_name:  actor_name  || null,
    target_id:   target_id   || null,
    target_email: target_email || null,
    details:     details     || {},
  }]);

  if (error) {
    console.error('auth_audit_log insert failed:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// Action names as they appear in auth.audit_log_entries payload->>'action'.
// VERIFY these by running the SQL query in the dashboard after a test event:
//   SELECT created_at, payload->>'action', payload FROM auth.audit_log_entries ORDER BY created_at DESC LIMIT 20;
const GOTRURE_ACTION_MAP = {
  'login_failed':                  'failed_login',               // ← verify exact string
  'password_recovery_requested':   'password_reset_requested',   // ← verify exact string
  'user_invitation_sent':          'member_invited',             // ← verify exact string
};

// Receives INSERT events from the PostgreSQL trigger on auth.audit_log_entries.
// Validates the shared secret, filters to tracked events, writes to auth_audit_log.
router.post('/auth/ingest-auth-event', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const row = req.body;
  const rawAction = row?.payload?.action;

  const eventType = GOTRURE_ACTION_MAP[rawAction];
  if (!eventType) {
    // Trigger fired for a non-tracked action — acknowledge and skip
    return res.json({ skipped: true, action: rawAction });
  }

  const targetEmail =
    row?.payload?.traits?.email ||
    row?.payload?.actor_username ||
    null;

  const { error } = await supabaseAdmin.from('auth_audit_log').insert([{
    event_type:   eventType,
    target_email: targetEmail,
    details: {
      raw_action: rawAction,
      ip_address: row.ip_address || null,
    },
  }]);

  if (error) {
    console.error('auth_audit_log ingest failed:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, event_type: eventType });
});

module.exports = router;
