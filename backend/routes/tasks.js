const express = require('express');
const router = express.Router();
const { generateOccurrences } = require('../lib/occurrenceGenerator');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

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

module.exports = router;
