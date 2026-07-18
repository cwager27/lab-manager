'use strict';

const WEEKDAY = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
};

function toISO(d) {
  return d.toISOString().split('T')[0];
}

function utcDay(y, m, d) {
  return new Date(Date.UTC(y, m, d));
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return utcDay(y, m - 1, d);
}

function addDays(d, n) {
  return utcDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n);
}

function addMonths(d, n) {
  return utcDay(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
}

function firstWeekdayOnOrAfter(date, weekdayName) {
  const target = WEEKDAY[weekdayName.toLowerCase()];
  const diff = (target - date.getUTCDay() + 7) % 7;
  return addDays(date, diff);
}

function nthWeekdayOfMonth(monthStart, weekdayName, n) {
  const target = WEEKDAY[weekdayName.toLowerCase()];
  const offset = ((target - monthStart.getUTCDay() + 7) % 7) + (n - 1) * 7;
  const d = utcDay(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1 + offset);
  return d.getUTCMonth() === monthStart.getUTCMonth() ? d : null;
}

// Pure function: compute all expected dates for a rule within [windowStart, windowEnd].
// anchor is only required for monthly_interval; ignored by other types.
function computeDates(rule, anchor, windowStart, windowEnd) {
  const dates = [];

  switch (rule.type) {
    case 'daily': {
      let d = new Date(windowStart);
      while (d <= windowEnd) {
        dates.push(toISO(d));
        d = addDays(d, 1);
      }
      break;
    }

    case 'weekly': {
      let d = firstWeekdayOnOrAfter(windowStart, rule.weekday);
      while (d <= windowEnd) {
        dates.push(toISO(d));
        d = addDays(d, 7);
      }
      break;
    }

    case 'monthly': {
      // rule.day = calendar day-of-month (1-based)
      let month = utcDay(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), 1);
      while (true) {
        const daysInMonth = utcDay(month.getUTCFullYear(), month.getUTCMonth() + 1, 0).getUTCDate();
        const d = utcDay(month.getUTCFullYear(), month.getUTCMonth(), Math.min(rule.day, daysInMonth));
        if (d > windowEnd) break;
        if (d >= windowStart) dates.push(toISO(d));
        month = utcDay(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
      }
      break;
    }

    case 'nth_weekday': {
      // rule.weekday, rule.weeks = [n, ...] (1-indexed: 1=first, 2=second, …)
      let month = utcDay(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), 1);
      const endMonth = utcDay(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth(), 1);
      while (month <= endMonth) {
        for (const n of rule.weeks) {
          const d = nthWeekdayOfMonth(month, rule.weekday, n);
          if (d && d >= windowStart && d <= windowEnd) dates.push(toISO(d));
        }
        month = utcDay(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
      }
      dates.sort();
      break;
    }

    case 'monthly_interval': {
      // rule.months = N; anchor sets the phase
      if (!anchor) throw new Error('monthly_interval rule requires recurrence_anchor');
      let d = parseDate(anchor);
      while (d < windowStart) d = addMonths(d, rule.months);
      while (d <= windowEnd) {
        dates.push(toISO(d));
        d = addMonths(d, rule.months);
      }
      break;
    }

    default:
      throw new Error(`Unknown recurrence rule type: ${rule.type}`);
  }

  return dates;
}

// Returns dates in [windowStart, windowEnd] that have no existing occurrence row.
async function computeGaps(supabase, task, windowStart, windowEnd) {
  const expected = computeDates(task.recurrence_rule, task.recurrence_anchor, windowStart, windowEnd);
  if (!expected.length) return [];

  const { data: existing, error } = await supabase
    .from('task_occurrences')
    .select('due_date')
    .eq('task_definition_id', task.id)
    .gte('due_date', toISO(windowStart))
    .lte('due_date', toISO(windowEnd));

  if (error) throw error;

  const existingSet = new Set((existing || []).map(r => r.due_date));
  return expected.filter(d => !existingSet.has(d));
}

// Generate occurrences for all published tasks with a recurrence_rule set.
// dryRun: compute gaps without inserting.
async function generateOccurrences(supabase, { windowDays = 90, dryRun = false } = {}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const windowEnd = addDays(today, windowDays);

  const { data: tasks, error } = await supabase
    .from('tasks_definitions')
    .select('id, title, frequency, category, recurrence_rule, recurrence_anchor')
    .eq('status', 'published')
    .not('recurrence_rule', 'is', null);

  if (error) throw error;

  const results = [];
  for (const task of (tasks || [])) {
    try {
      const gaps = await computeGaps(supabase, task, today, windowEnd);
      if (!dryRun && gaps.length) {
        const { error: insertErr } = await supabase
          .from('task_occurrences')
          .insert(gaps.map(due_date => ({
            task_definition_id: task.id,
            due_date,
            status: 'unassigned'
          })));
        if (insertErr) throw insertErr;
      }
      results.push({ taskId: task.id, title: task.title, gaps: gaps.length });
    } catch (err) {
      results.push({ taskId: task.id, title: task.title, error: err.message });
    }
  }

  return {
    windowStart: toISO(today),
    windowEnd: toISO(windowEnd),
    dryRun,
    tasks: results,
    totalGaps: results.reduce((s, r) => s + (r.gaps || 0), 0)
  };
}

module.exports = { generateOccurrences, computeDates, computeGaps, parseDate };
