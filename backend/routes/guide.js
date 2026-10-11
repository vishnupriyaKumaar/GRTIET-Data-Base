// "User Guidelines" (gear button, Admin only): lets the Admin download the
// complete project ZIP (source code, no secrets) that is stored inside the app at
//   backend/assets/downloads/GRT-Student-App.zip
// It is served through the API (not as a public file) so only a logged-in Admin gets it.
const path = require('path');
const fs = require('fs');
const express = require('express');

const router = express.Router();
const ZIP_NAME = 'GRT-Student-App.zip';
const ZIP_PATH = path.join(__dirname, '..', 'assets', 'downloads', ZIP_NAME);

router.get('/download', (req, res) => {
  if (!fs.existsSync(ZIP_PATH)) {
    return res.status(404).json({
      message: 'The project ZIP is not stored in this copy of the app. Put ' + ZIP_NAME + ' into backend/assets/downloads/ and redeploy.',
    });
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${ZIP_NAME}"`);
  res.setHeader('Content-Length', fs.statSync(ZIP_PATH).size);
  fs.createReadStream(ZIP_PATH).pipe(res);
});

module.exports = router;
