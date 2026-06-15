const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'oauth-credentials.json')));
const { client_secret, client_id, redirect_uris } = credentials.installed;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('Authorize this app by visiting this url:');
console.log(authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Enter the code from that page here: ', (code) => {
  rl.close();
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token', err);
    fs.writeFileSync(path.join(__dirname, 'drive-token.json'), JSON.stringify(token));
    console.log('Token stored to drive-token.json');
  });
});
