// Vercel entry point. Every /api/* request is rewritten to this file (see
// vercel.json) and handed to the Express app, which does its own routing.
// The React frontend is built into /dist and served by Vercel's CDN, so this
// one project is the whole app - no separate frontend/backend deployments.
module.exports = require('../backend/app');
