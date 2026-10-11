// Prints your Firebase service-account key as ONE line, ready to paste into
// the Vercel environment variable FIREBASE_SERVICE_ACCOUNT_JSON.
//
//   npm run firebase-env                       (uses backend/serviceAccountKey.json)
//   npm run firebase-env -- path/to/key.json   (or point at any key file)
const fs = require('fs');
const path = require('path');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backend', 'serviceAccountKey.json'));

if (!fs.existsSync(file)) {
  console.error(`\nKey file not found: ${file}\n` +
    'Put your Firebase serviceAccountKey.json in the backend/ folder, or run:\n' +
    '  npm run firebase-env -- path/to/serviceAccountKey.json\n' +
    '(Firebase console -> Project settings -> Service accounts -> Generate new private key)\n');
  process.exit(1);
}

let json;
try {
  json = JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')));
} catch (e) {
  console.error('That file is not valid JSON: ' + e.message);
  process.exit(1);
}

console.log('\nVariable name : FIREBASE_SERVICE_ACCOUNT_JSON');
console.log('Value (copy everything on the next line):\n');
console.log(json);
console.log('\nTreat this like a password - do not share it or commit it to GitHub.\n');
