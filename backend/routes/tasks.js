const express = require('express');
const router = express.Router();
const transporter = { sendMail: async () => {} }; // emails disabled

function reminderHtml(name, taskName, dueDate, message) {
  const fmt = new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fff;">
    <h1 style="color:#7B3FA0;margin:0 0 24px;font-size:20px;letter-spacing:0.05em;">PETLJAK LAB</h1>
    <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi ${name},</p>
    <p style="color:#333;font-size:15px;margin:0 0 20px;">${message}</p>
    <div style="background:#F5EEF8;border-left:4px solid #7B3FA0;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <strong style="color:#7B3FA0;font-size:17px;">${taskName}</strong>
      <p style="color:#555;margin:8px 0 0;font-size:13px;">Due: ${fmt}</p>
    </div>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Lab Manager</a>
  </div>`;
}

function overdueNoticeHtml(pmName, assigneeName, taskName, dueDate) {
  const fmt = new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fff;">
    <h1 style="color:#7B3FA0;margin:0 0 24px;font-size:20px;letter-spacing:0.05em;">PETLJAK LAB</h1>
    <p style="color:#333;font-size:15px;margin:0 0 12px;">Hi ${pmName},</p>
    <p style="color:#333;font-size:15px;margin:0 0 20px;">The following task was not completed by its due date:</p>
    <div style="background:#FDEDEC;border-left:4px solid #E74C3C;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <strong style="color:#C0392B;font-size:17px;">${taskName}</strong>
      <p style="color:#555;margin:8px 0 0;font-size:13px;">Was due: ${fmt}</p>
      <p style="color:#555;margin:4px 0 0;font-size:13px;">Assigned to: ${assigneeName}</p>
    </div>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#E74C3C;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in Lab Manager</a>
  </div>`;
}

// ── Occurrence generation ─────────────────────────────────────────────────────

router.post('/tasks/generate-occurrences', async (req, res) => {
  try {
    const { windowDays = 90, dryRun = false } = req.body || {};
    const result = await generateOccurrences(supabaseAdmin, {
      windowDays: Number(windowDays),
      dryRun: Boolean(dryRun),
    });
    res.json(result);
  } catch (err) {
    console.error('generate-occurrences error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Tasks2 initial data ────────────────────────────────────────────────────────

router.get('/tasks2/data', async (req, res) => {
  try {
    const [tasksRes, profilesRes, vacsRes] = await Promise.all([
      supabaseAdmin
        .from('tasks_definitions')
        .select('id, title, category, frequency, group_name, sort_order, recurrence_rule')
        .eq('status', 'published')
        .not('recurrence_rule', 'is', null)
        .order('sort_order'),
      supabaseAdmin.from('profiles').select('id, full_name, email, role'),
      supabaseAdmin
        .from('vacation_requests')
        .select('requested_by, start_date, end_date, leave_type, status')
        .eq('status', 'approved'),
    ]);
    res.json({
      tasks: tasksRes.data || [],
      profiles: profilesRes.data || [],
      vacations: vacsRes.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Occurrences for selected tasks in a date range ────────────────────────────

router.get('/tasks2/occurrences', async (req, res) => {
  try {
    const { taskIds, start, end } = req.query;
    const ids = taskIds ? taskIds.split(',').filter(Boolean) : [];
    let q = supabaseAdmin
      .from('task_occurrences')
      .select('id, task_definition_id, due_date, status, assigned_to, assignee:profiles(full_name)')
      .order('due_date');
    if (ids.length) q = q.in('task_definition_id', ids);
    if (start) q = q.gte('due_date', start);
    if (end) q = q.lte('due_date', end);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Ensure occurrences exist for specific tasks in a date range ───────────────
// Used by the assignment wizard to backfill past or newly-created task occurrences.

router.post('/tasks2/ensure-occurrences', async (req, res) => {
  try {
    const { taskIds, start, end } = req.body || {};
    if (!taskIds?.length || !start || !end) return res.json({ inserted: 0 });

    const windowStart = parseDate(start);
    const windowEnd = parseDate(end);

    const { data: taskDefs, error: taskErr } = await supabaseAdmin
      .from('tasks_definitions')
      .select('id, title, frequency, recurrence_rule, recurrence_anchor')
      .in('id', taskIds)
      .eq('status', 'published')
      .not('recurrence_rule', 'is', null);

    if (taskErr) throw taskErr;

    let totalInserted = 0;
    for (const task of (taskDefs || [])) {
      const gaps = await computeGaps(supabaseAdmin, task, windowStart, windowEnd);
      if (gaps.length) {
        const { error: insertErr } = await supabaseAdmin
          .from('task_occurrences')
          .insert(gaps.map(due_date => ({ task_definition_id: task.id, due_date, status: 'unassigned' })));
        if (insertErr) throw insertErr;
        totalInserted += gaps.length;
      }
    }
    res.json({ inserted: totalInserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Calendar month data ────────────────────────────────────────────────────────

router.get('/tasks2/calendar', async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = Number(year);
    const m = Number(month);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    const { data, error } = await supabaseAdmin
      .from('task_occurrences')
      .select('id, task_definition_id, due_date, status, assigned_to, task:tasks_definitions(title, category, frequency), assignee:profiles(full_name)')
      .gte('due_date', start)
      .lte('due_date', end)
      .order('due_date');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Unassigned occurrences within cadence-scaled lookahead windows ────────────

const LOOKAHEAD_DAYS = { daily: 7, weekly: 14, biweekly: 30, monthly: 60, quarterly: 90, yearly: 90 };

router.get('/tasks2/unassigned', async (req, res) => {
  try {
    const todayMs = Date.now();
    const todayStr = new Date(todayMs).toISOString().split('T')[0];
    const maxEnd = new Date(todayMs + 90 * 86400000).toISOString().split('T')[0];

    const { data: occs, error } = await supabaseAdmin
      .from('task_occurrences')
      .select('id, task_definition_id, due_date, task:tasks_definitions(title, category, frequency, group_name)')
      .eq('status', 'unassigned')
      .gte('due_date', todayStr)
      .lte('due_date', maxEnd)
      .order('due_date');
    if (error) throw error;

    const taskIds = [...new Set((occs || []).map(o => o.task_definition_id))];

    const { data: lastAssigned } = taskIds.length
      ? await supabaseAdmin
          .from('task_occurrences')
          .select('task_definition_id, due_date')
          .in('task_definition_id', taskIds)
          .not('assigned_to', 'is', null)
          .order('due_date', { ascending: false })
      : { data: [] };

    const lastByTask = {};
    (lastAssigned || []).forEach(r => {
      if (!lastByTask[r.task_definition_id]) lastByTask[r.task_definition_id] = r.due_date;
    });

    const result = (occs || [])
      .filter(o => {
        const freq = (o.task?.frequency || 'monthly').toLowerCase();
        const window = LOOKAHEAD_DAYS[freq] ?? 60;
        const daysAhead = (new Date(o.due_date + 'T00:00:00Z') - new Date(todayStr + 'T00:00:00Z')) / 86400000;
        return daysAhead <= window;
      })
      .map(o => ({
        id: o.id,
        task_definition_id: o.task_definition_id,
        due_date: o.due_date,
        task: o.task,
        lastAssignedThrough: lastByTask[o.task_definition_id] || null,
        daysUntilDue: Math.round(
          (new Date(o.due_date + 'T00:00:00Z') - new Date(todayStr + 'T00:00:00Z')) / 86400000
        ),
      }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Rotation algorithm ─────────────────────────────────────────────────────────

function runRotation(occs, assigneeIds, rotateEvery, vacations) {
  function unavailable(userId, dateStr) {
    return vacations.some(v =>
      v.requested_by === userId && dateStr >= v.start_date && dateStr <= v.end_date
    );
  }

  const emptyPool = assigneeIds.length === 0;
  const queue = [...assigneeIds];
  let sinceRotate = 0;
  const rows = [];

  for (const occ of occs) {
    let tries = 0;
    let assigned = null;
    let autoReassigned = false;

    while (tries < queue.length) {
      if (!unavailable(queue[0], occ.due_date)) {
        assigned = queue[0];
        break;
      }
      queue.push(queue.shift());
      autoReassigned = true;
      tries++;
    }

    rows.push({
      occurrenceId: occ.id,
      due_date: occ.due_date,
      task_definition_id: occ.task_definition_id,
      assignedTo: assigned,
      previousAssignee: occ.assigned_to || null,
      previousAssigneeName: occ.assignee?.full_name || null,
      autoReassigned: autoReassigned && assigned !== null,
      unresolvable: emptyPool,
      blocked: !emptyPool && assigned === null,
    });

    sinceRotate++;
    if (sinceRotate >= rotateEvery) {
      queue.push(queue.shift());
      sinceRotate = 0;
    }
  }

  return rows;
}

// ── Preview + assign ───────────────────────────────────────────────────────────

router.post('/tasks2/assign', async (req, res) => {
  try {
    const {
      assigneeIds = [],
      rotateEvery = 1,
      occurrenceIds = [],
      taskIds = [],
      dryRun = false,
    } = req.body;

    if (!occurrenceIds.length) return res.json({ preview: [], dryRun });

    const [occRes, vacRes] = await Promise.all([
      supabaseAdmin
        .from('task_occurrences')
        .select('id, task_definition_id, due_date, assigned_to, assignee:profiles(full_name)')
        .in('id', occurrenceIds)
        .order('due_date'),
      assigneeIds.length
        ? supabaseAdmin
            .from('vacation_requests')
            .select('requested_by, start_date, end_date')
            .eq('status', 'approved')
            .in('requested_by', assigneeIds)
        : Promise.resolve({ data: [] }),
    ]);

    if (occRes.error) throw occRes.error;

    const rows = runRotation(
      occRes.data || [],
      assigneeIds,
      Number(rotateEvery),
      vacRes.data || []
    );

    if (!dryRun) {
      await Promise.all(
        rows.map(r =>
          supabaseAdmin
            .from('task_occurrences')
            .update({
              assigned_to: r.assignedTo,
              status: r.assignedTo ? 'assigned' : 'unassigned',
            })
            .eq('id', r.occurrenceId)
        )
      );

      const byTask = {};
      rows.forEach(r => {
        if (!byTask[r.task_definition_id]) byTask[r.task_definition_id] = [];
        byTask[r.task_definition_id].push(r.due_date);
      });
      await Promise.all(
        Object.entries(byTask).map(([taskId, dates]) =>
          supabaseAdmin.from('assignment_rules').insert({
            task_definition_id: taskId,
            assignee_ids: assigneeIds,
            rotate_every: Number(rotateEvery),
            start_date: dates[0],
            end_date: dates[dates.length - 1],
          })
        )
      );
    }

    res.json({ preview: rows, dryRun });
  } catch (err) {
    console.error('tasks2/assign error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Manual reminder ────────────────────────────────────────────────────────────

router.post('/tasks2/remind', async (req, res) => {
  try {
    const { occurrenceId } = req.body;
    if (!occurrenceId) return res.status(400).json({ error: 'occurrenceId required' });

    const { data: occ, error } = await supabaseAdmin
      .from('task_occurrences')
      .select('id, due_date, task_def:tasks_definitions(title, group_name), assignee:profiles!assigned_to(email, full_name)')
      .eq('id', occurrenceId)
      .single();

    if (error || !occ) return res.status(404).json({ error: 'Occurrence not found' });
    if (!occ.assignee?.email) return res.status(400).json({ error: 'No assignee email found' });

    const taskName = occ.task_def?.group_name || occ.task_def?.title || 'Task';
    await mailer.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: occ.assignee.email,
      subject: `Petljak Lab — Reminder: ${taskName}`,
      html: reminderHtml(occ.assignee.full_name, taskName, occ.due_date, 'You have a task that needs your attention:'),
    });

    res.json({ success: true, sentTo: occ.assignee.email });
  } catch (err) {
    console.error('tasks2/remind error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
