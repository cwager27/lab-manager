const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'oauth-credentials.json')));
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const token = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'drive-token.json')));
oAuth2Client.setCredentials(token);

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const TABLES_TO_BACKUP = [
  'profiles', 'tasks_definitions', 'task_assignments', 'task_responses', 'task_archives',
  'sporadic_tasks', 'vacation_requests', 'lab_meetings',
  'grants', 'orders', 'reagents', 'nanoseq_reagents',
  'cell_lines', 'mouse_samples', 'human_samples', 'sample_audit_log',
  'compliance_tasks', 'compliance_assignments', 'compliance_responses', 'compliance_archives', 'compliance_studies',
  'lab_contacts', 'task_reassignments'
];

async function runBackup() {
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const timestamp = new Date().toISOString().split('T')[0];

  const folderRes = await drive.files.create({
    requestBody: {
      name: `Backup ${timestamp}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [DRIVE_FOLDER_ID]
    },
    fields: 'id'
  });
  const backupFolderId = folderRes.data.id;

  const results = [];

  for (const table of TABLES_TO_BACKUP) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        results.push({ table, status: 'error', message: error.message });
        continue;
      }

      const jsonContent = JSON.stringify(data || [], null, 2);

      await drive.files.create({
        requestBody: {
          name: `${table}.json`,
          parents: [backupFolderId],
          mimeType: 'application/json'
        },
        media: {
          mimeType: 'application/json',
          body: jsonContent
        }
      });

      results.push({ table, status: 'success', rows: (data || []).length });
    } catch (err) {
      results.push({ table, status: 'error', message: err.message });
    }
  }

  return { backupFolderId, results, timestamp };
}

router.get('/run-backup', async (req, res) => {
  try {
    const result = await runBackup();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, runBackup };
