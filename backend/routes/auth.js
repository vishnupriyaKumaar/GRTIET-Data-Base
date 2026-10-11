const router = require('express').Router();
const A = require('../authStore');

const ipOf = (req) => req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
const fail = (res, e) => res.status(e.status || 500).json({ message: e.message || 'Server error.' });

// Admin login - the only role that needs a password.
router.post('/login', async (req, res) => {
  const ip = ipOf(req);
  if (A.throttled(ip)) return res.status(429).json({ message: 'Too many wrong passwords. Please wait 10 minutes and try again.' });
  try {
    const pv = await A.adminLogin(req.body && req.body.password);
    if (pv === null) { A.noteFail(ip); return res.status(401).json({ message: 'Incorrect password.' }); }
    A.noteOk(ip);
    A.startSession(res, 'admin', pv);
    res.json({ success: true, role: 'admin' });
  } catch (e) { fail(res, e); }
});

// Student ("entry") access - no password at all; only unlocks the Add Student form.
router.post('/student-login', (req, res) => {
  try {
    A.startSession(res, 'entry', '-');
    res.json({ success: true, role: 'entry' });
  } catch (e) { fail(res, e); }
});

router.get('/me', (req, res) => {
  if (req.sessionError) return fail(res, req.sessionError);
  if (!req.session) return res.status(401).json({ message: 'Please log in.' });
  res.json({ role: req.session.role });
});

router.post('/logout', (req, res) => { A.endSession(res); res.json({ success: true }); });

router.post('/change-password', A.requireAuth, A.admin, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if ((await A.adminLogin(oldPassword)) === null) return res.status(401).json({ message: 'Current password is incorrect.' });
    if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ message: 'Use at least 8 characters.' });
    await A.setPassword(newPassword);
    A.endSession(res);
    res.json({ success: true, message: 'Password updated. Please log in again.' });
  } catch (e) { fail(res, e); }
});

module.exports = router;
