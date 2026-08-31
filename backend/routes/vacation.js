const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const transporter = require('../lib/mailer');

router.post('/vacation-request', async (req, res) => {
  const { requestId, memberName, memberEmail, startDate, endDate, leaveType, comments } = req.body;
  try {
    const { data: admins } = await supabase
      .from('profiles').select('email, full_name').eq('role', 'admin');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const approveUrl = `${backendUrl}/api/vacation-action?id=${requestId}&action=approved`;
    const denyUrl = `${backendUrl}/api/vacation-action?id=${requestId}&action=denied`;
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

router.get('/vacation-requests/all', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vacation_requests')
      .select('*, requester:profiles!vacation_requests_requested_by_fkey(full_name, email)')
      .order('start_date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    // Send approval/denial email to requester
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

    // If approved, reassign tasks
    if (action === 'approved') {
      try {
        await reassignVacationTasks(request);
        console.log('Reassignment completed for', request.requester.full_name);
      } catch (err) {
        console.error('Reassignment error:', err);
      }
    }

    res.send(`<html><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f6fb;margin:0;"><div style="background:white;padding:40px;border-radius:12px;text-align:center;max-width:400px;border:1px solid #e8e4f0;"><h2 style="color:${action === 'approved' ? '#27AE60' : '#E74C3C'};">Request ${action === 'approved' ? 'Approved' : 'Denied'}</h2><p style="color:#5A5A7A;">${request.requester.full_name}'s vacation request has been ${action}. They have been notified${action === 'approved' ? ' and their tasks have been reassigned.' : '.'}</p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Return to Platform</a></div></body></html>`);
  } catch (error) {
    console.error('Vacation action error:', error);
    res.status(500).send('Something went wrong.');
  }
});

async function reassignVacationTasks(vacationRequest) {
  const startDate = new Date(vacationRequest.start_date);
  const endDate = new Date(vacationRequest.end_date);
  const vacationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // Check for lab meetings where this person is presenting during vacation
  const { data: affectedMeetings } = await supabase
    .from('lab_meetings')
    .select('*')
    .eq('presenter_id', vacationRequest.requested_by)
    .eq('status', 'scheduled')
    .gte('meeting_date', vacationRequest.start_date)
    .lte('meeting_date', vacationRequest.end_date);

  if (affectedMeetings && affectedMeetings.length > 0) {
    // Get all approved vacations to filter out unavailable members
    const { data: overlappingVacationsForMeetings } = await supabase
      .from('vacation_requests')
      .select('requested_by, start_date, end_date')
      .eq('status', 'approved');

    const { data: allMembersForMeetings } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', vacationRequest.requested_by)
      .in('role', ['admin', 'pm', 'member']);

    // Pre-compute ratios once and mutate in-place each iteration so meetings
    // distribute across the team rather than all landing on the same person.
    const now = new Date();
    const membersWithLiveRatio = (allMembersForMeetings || []).map(m => {
      const joinedAt = new Date(m.joined_at || m.created_at);
      const daysAsMember = Math.max(1, Math.ceil((now - joinedAt) / (1000 * 60 * 60 * 24)));
      return { ...m, daysAsMember, ratio: (m.task_counter || 0) / daysAsMember };
    });

    for (const meeting of affectedMeetings) {
      // Find members not on vacation for this specific meeting date
      const availableMembers = membersWithLiveRatio.filter(m => {
        return !(overlappingVacationsForMeetings || []).some(v =>
          v.requested_by === m.id &&
          v.start_date <= meeting.meeting_date &&
          v.end_date >= meeting.meeting_date
        );
      });

      if (availableMembers.length === 0) {
        // No one available - email Mia
        const { data: admins } = await supabase.from('profiles').select('email').eq('role', 'admin');
        for (const admin of (admins || [])) {
          await transporter.sendMail({
            from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
            to: admin.email,
            subject: `Petljak Lab — Action Required: No Available Presenter for ${meeting.meeting_date}`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
                <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
                  <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
                  <h2 style="font-size:18px;color:#E74C3C;margin:0 0 8px;">Action Required</h2>
                  <p style="color:#5A5A7A;font-size:14px;margin:0 0 24px;">${vacationRequest.requester.full_name} was scheduled to present on ${meeting.meeting_date} but is now on vacation. No other lab members are available. Please manually assign a presenter.</p>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Go to Platform</a>
                </div>
              </div>
            `
          });
        }
        continue;
      }

      // Sort available members by their current live ratio
      availableMembers.sort((a, b) => a.ratio - b.ratio);
      const newPresenter = availableMembers[0];

      // Update this member's ratio in the master array so the next meeting
      // iteration sees the increased load and distributes fairly
      newPresenter.task_counter = (newPresenter.task_counter || 0) + 1;
      newPresenter.ratio = newPresenter.task_counter / newPresenter.daysAsMember;

      // Generate confirmation token
      const token = require('crypto').randomBytes(16).toString('hex');

      await supabase.from('lab_meetings').update({
        presenter_id: newPresenter.id,
        confirmation_status: 'pending',
        confirmation_token: token,
        reminder_count: 0,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', meeting.id);

      const confirmUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/confirm-presenter?token=${token}`;

      // Email new presenter
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: newPresenter.email,
        subject: `Petljak Lab — You are now presenting at the ${meeting.meeting_date} meeting — Please Confirm`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">You Have Been Assigned to Present</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">${vacationRequest.requester.full_name} is on vacation, so you have been assigned to present at the <strong>${meeting.meeting_date}</strong> lab meeting.</p>
              <p style="color:#5A5A7A;font-size:13px;margin:0 0 24px;">Thursdays 1:30–3pm · Zoom: 987 7040 0275 · Passcode: 676073</p>
              <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#27AE60;color:white;text-decoration:none;border-radius:8px;font-weight:600;margin-right:10px;">Confirm I'm Aware</a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Schedule</a>
            </div>
          </div>
        `
      });
    }
  }

  // Get all task assignments for the vacationing person
  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('*, task:tasks_definitions(title, frequency, category)')
    .eq('assigned_to', vacationRequest.requested_by)
    .eq('status', 'pending');

  if (!assignments || assignments.length === 0) return;

  // Filter tasks that fall within vacation period
  const affectedAssignments = assignments.filter(a => {
    if (!a.cycle_start && !a.cycle_end) return false;
    const cycleStart = new Date(a.cycle_start);
    const cycleEnd = new Date(a.cycle_end);
    // Task overlaps with vacation period
    return cycleStart <= endDate && cycleEnd >= startDate;
  });

  if (affectedAssignments.length === 0) return;

  // Get all active members except the vacationing person
  const { data: allMembersRaw } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', vacationRequest.requested_by)
    .in('role', ['admin', 'pm', 'member']);

  // Get all approved vacation requests that overlap with this vacation period
  const { data: overlappingVacations } = await supabase
    .from('vacation_requests')
    .select('requested_by, start_date, end_date')
    .eq('status', 'approved')
    .lte('start_date', vacationRequest.end_date)
    .gte('end_date', vacationRequest.start_date);

  const onVacationIds = new Set((overlappingVacations || []).map(v => v.requested_by));

  // Filter out members who are also on vacation during this period
  const allMembers = (allMembersRaw || []).filter(m => !onVacationIds.has(m.id));

  if (!allMembers || allMembers.length === 0) {
    // No one available — email Mia
    const { data: mia } = await supabase.from('profiles').select('email').eq('role', 'admin').single();
    if (mia) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: mia.email,
        subject: `Petljak Lab — Action Required: No Available Members for Task Reassignment`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#E74C3C;margin:0 0 8px;">Action Required</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">${vacationRequest.requester.full_name} has been approved for vacation from ${vacationRequest.start_date} to ${vacationRequest.end_date}, but there are no available lab members to reassign their ${affectedAssignments.length} task(s) to.</p>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 24px;">Please manually reassign their tasks in the platform.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Go to Platform</a>
            </div>
          </div>
        `
      });
    }
    return;
  }

  // Get managers for notification
  const { data: managers } = await supabase
    .from('profiles').select('email, full_name').in('role', ['admin', 'pm']);

  // Calculate workload ratio for each member: task_counter / days_as_member
  const now = new Date();
  const membersWithRatio = allMembers.map(m => {
    const joinedAt = new Date(m.joined_at || m.created_at);
    const daysAsMember = Math.max(1, Math.ceil((now - joinedAt) / (1000 * 60 * 60 * 24)));
    const ratio = (m.task_counter || 0) / daysAsMember;
    return { ...m, ratio };
  });

  // Sort by ratio ascending (lowest ratio = least burdened)
  membersWithRatio.sort((a, b) => a.ratio - b.ratio);

  const reassignments = [];

  for (const assignment of affectedAssignments) {
    // Pick member with lowest ratio
    const newAssignee = membersWithRatio[0];

    // Update task assignment
    await supabase.from('task_assignments')
      .update({ assigned_to: newAssignee.id, updated_at: new Date().toISOString() })
      .eq('id', assignment.id);

    // Increment new assignee's task counter
    await supabase.from('profiles')
      .update({ task_counter: (newAssignee.task_counter || 0) + 1 })
      .eq('id', newAssignee.id);

    // Update local counter so next iteration reflects new ratio
    newAssignee.task_counter = (newAssignee.task_counter || 0) + 1;
    const joinedAt = new Date(newAssignee.joined_at || newAssignee.created_at);
    const daysAsMember = Math.max(1, Math.ceil((now - joinedAt) / (1000 * 60 * 60 * 24)));
    newAssignee.ratio = newAssignee.task_counter / daysAsMember;

    // Re-sort after updating
    membersWithRatio.sort((a, b) => a.ratio - b.ratio);

    // Log reassignment
    await supabase.from('task_reassignments').insert([{
      task_assignment_id: assignment.id,
      task_title: assignment.task?.title || 'Unknown Task',
      original_assignee_id: vacationRequest.requested_by,
      original_assignee_name: vacationRequest.requester.full_name,
      new_assignee_id: newAssignee.id,
      new_assignee_name: newAssignee.full_name,
      vacation_request_id: vacationRequest.id,
      reason: `Vacation: ${vacationRequest.start_date} to ${vacationRequest.end_date}`
    }]);

    reassignments.push({ task: assignment.task?.title, newAssignee: newAssignee.full_name });

    // Email new assignee
    await transporter.sendMail({
      from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
      to: newAssignee.email,
      subject: `Petljak Lab — New Task Assigned: ${assignment.task?.title}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
            <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
            <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Task Reassigned to You</h2>
            <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">Hi ${newAssignee.full_name}, <strong>${vacationRequest.requester.full_name}</strong> is on vacation from ${vacationRequest.start_date} to ${vacationRequest.end_date}.</p>
            <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;">The following task has been reassigned to you:</p>
            <div style="background:#f8f6fb;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid #e8e4f0;">
              <p style="margin:0 0 4px;font-weight:600;color:#1A1A2E;">${assignment.task?.title}</p>
              <p style="margin:0;font-size:13px;color:#5A5A7A;">${assignment.task?.category} · ${assignment.task?.frequency} · ${assignment.cycle_start} to ${assignment.cycle_end}</p>             </div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View in Platform</a>
          </div>
        </div>
      `
    });
  }

  // Email all managers summary
  if (reassignments.length > 0 && managers) {
    const taskRows = reassignments.map(r => `<li style="margin-bottom:6px;color:#5A5A7A;">${r.task} → <strong>${r.newAssignee}</strong></li>`).join('');
    for (const manager of managers) {
      await transporter.sendMail({
        from: `"Petljak Lab" <${process.env.GMAIL_USER}>`,
        to: manager.email,
        subject: `Petljak Lab — Task Reassignment Summary: ${vacationRequest.requester.full_name}'s Vacation`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f6fb;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e8e4f0;">
              <h1 style="color:#7B3FA0;font-size:20px;margin:0 0 24px;">PETLJAK LAB</h1>
              <h2 style="font-size:18px;color:#1A1A2E;margin:0 0 8px;">Task Reassignment Summary</h2>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 16px;"><strong>${vacationRequest.requester.full_name}</strong> has been approved for vacation from <strong>${vacationRequest.start_date}</strong> to <strong>${vacationRequest.end_date}</strong>.</p>
              <p style="color:#5A5A7A;font-size:14px;margin:0 0 12px;">The following ${reassignments.length} task(s) have been reassigned:</p>
              <ul style="padding-left:20px;margin:0 0 24px;">${taskRows}</ul>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display:inline-block;padding:12px 24px;background:#7B3FA0;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View in Platform</a>
            </div>
          </div>
        `
      });
    }
  }
}

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
