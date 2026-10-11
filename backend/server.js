// LOCAL server (your own computer). Not used on Vercel - there, api/index.js
// exports the same app and Vercel's CDN serves the website.
//
//   npm run dev                -> this API on :5000  +  Vite dev server on :5173
//   npm run build && npm start -> this file serves the built website AND the API on :5000
const path = require('path');
const fs = require('fs');
const express = require('express');
const app = require('./app');

const DIST = path.join(__dirname, '..', 'dist');

process.on('unhandledRejection', (err) => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const server = express();
server.use(app);

if (fs.existsSync(DIST)) {
  server.use(express.static(DIST, {
    setHeaders: (res, filePath) => {
      if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  server.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  console.warn('No /dist folder yet - run "npm run build" to serve the website from here,\nor use "npm run dev" and open http://localhost:5173');
}

const START_PORT = Number(process.env.PORT) || 5000;

function start(port, triesLeft) {
  const listener = server.listen(port);
  listener.once('listening', () => {
    const url = `http://localhost:${port}`;
    console.log('\n=====================================================');
    console.log(`  GRT Student App is RUNNING.  Open:  ${url}`);
    console.log('  Keep this window open while you use the app.');
    console.log('=====================================================\n');
    if (process.env.OPEN_BROWSER === '1') {
      try { require('./openBrowser').openDefault(url); } catch { /* ignore */ }
    }
  });
  listener.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      console.warn(`Port ${port} is busy, trying ${port + 1} ...`);
      return start(port + 1, triesLeft - 1);
    }
    console.error('Could not start the server:', err.message);
    process.exit(1);
  });
}
start(START_PORT, 10);
