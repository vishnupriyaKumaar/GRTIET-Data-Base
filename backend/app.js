const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const guideRoutes = require('./routes/guide');
const { session, requireAuth, admin, getSecret } = require('./authStore');
const db = require('./db');
const store = require('./store');

// The Express app WITHOUT app.listen(). Vercel imports it through api/index.js;
// on your own PC backend/server.js listens on a port. Same code, both places.
const app = express();
app.set('trust proxy', true); // real client IP behind Vercel's proxy
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

// Never let a browser or CDN cache an API answer (login state, records ...).
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Public: health check (shows what is set up, never any secret).
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'GRT Student App is running.',
    checks: {
      jwtSecret: !!getSecret(),
      firebaseCredentials: db.isFirebaseConfigured(),
    },
    storage: db.driverName(),
    maxDocumentKB: db.MAX_DOC_BYTES / 1024,
    maxStudentRecordKB: store.MAX_RECORD_BYTES / 1024,
  });
});

app.use(session);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/guide', requireAuth, admin, guideRoutes);

// Custom Excel download: Admin picks the columns for each batch. The file is
// built in memory from the database and streamed back (nothing is stored).
app.post('/api/download-excel', requireAuth, admin, async (req, res) => {
  try {
    const buffer = await store.buildCustomExcel(req.body && req.body.selections);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="GRT-Student-Records.xlsx"');
    // Streamed in small chunks: Vercel limits a normal reply to 4.5 MB, but a
    // streamed reply has no such limit, so big batches with photos still download.
    const buf = Buffer.from(buffer);
    for (let i = 0; i < buf.length; i += 64 * 1024) res.write(buf.subarray(i, i + 64 * 1024));
    res.end();
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// Unknown /api routes -> JSON 404.
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Last-resort error handler: always JSON, never crash the request.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request data.' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ message: 'The data sent is too large.' });
  console.error('Unhandled error:', err);
  if (res.headersSent) return res.end();
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

module.exports = app;
