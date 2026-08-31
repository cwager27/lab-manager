const nodemailer = require('nodemailer');

const enabled = process.env.EMAILS_ENABLED === 'true';

const transporter = enabled
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : { sendMail: async (opts) => { console.log('[email disabled]', opts.subject, '→', opts.to); } };

module.exports = transporter;
