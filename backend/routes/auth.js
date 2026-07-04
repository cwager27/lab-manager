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

    // 1. Reassign future scheduled meetings using the same workload-ratio logic as vacation reassignment
    const { data: futureMeetings } = await supabaseAdmin
      .from('lab_meetings')
      .select('*')
      .eq('presenter_id', id)
      .eq('status', 'scheduled')
      .gte('meeting_date', today);

    if (futureMeetings && futureMeetings.length > 0) {
      const { data: allMembers } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .neq('id', id)
        .in('role', ['admin', 'pm', 'member']);

      const { data: approvedVacations } = await supabaseAdmin
        .from('vacation_requests')
        .select('requested_by, start_date, end_date')
        .eq('status', 'approved');

      const now = new Date();

      // Pre-compute ratios once and mutate in-place so multiple missed meetings
      // distribute across the team rather than all landing on the same person.
      const membersWithLiveRatio = (allMembers || []).map(m => {
        const joined = new Date(m.joined_at || m.created_at);
        const days = Math.max(1, Math.ceil((now - joined) / (1000 * 60 * 60 * 24)));
        return { ...m, days, ratio: (m.task_counter || 0) / days };
      });

      for (const meeting of futureMeetings) {
        // Filter out members on vacation on the meeting date
        const available = membersWithLiveRatio.filter(m => {
          return !(approvedVacations || []).some(v =>
            v.requested_by === m.id &&
            v.start_date <= meeting.meeting_date &&
            v.end_date >= meeting.meeting_date
          );
        });

        if (available.length === 0) {
          // No one available — leave unassigned so admin can handle manually
          await supabaseAdmin.from('lab_meetings')
            .update({ presenter_id: null, updated_at: new Date().toISOString() })
            .eq('id', meeting.id);
          continue;
        }

        // Sort by current live ratio, pick the least burdened
        available.sort((a, b) => a.ratio - b.ratio);
        const newPresenter = available[0];

        // Update ratio in the master array so the next iteration distributes fairly
        newPresenter.task_counter = (newPresenter.task_counter || 0) + 1;
        newPresenter.ratio = newPresenter.task_counter / newPresenter.days;

        const token = require('crypto').randomBytes(16).toString('hex');

        await supabaseAdmin.from('lab_meetings').update({
          presenter_id: newPresenter.id,
          confirmation_status: 'pending',
          confirmation_token: token,
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

    // 4. Delete their lab_contacts entry
    const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', id).maybeSingle();
    if (prof?.email) {
      await supabaseAdmin.from('lab_contacts').delete().ilike('email', prof.email);
    }

    // 5. Delete auth user (cascades to profiles row via FK)
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
