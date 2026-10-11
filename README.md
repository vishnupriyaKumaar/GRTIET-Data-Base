# GRT Student Records Register (v4 - one Vercel deployment)

React frontend + Express API in **one project, one deployment** (see `DEPLOY-ONE-TIME.md`). Data lives in Firebase Firestore;
**every stored item is under 50 KB** and a whole student record (details + photo + signature) is under 50 KB.

## What changed in this version
- **OTC intro** (animated logo + sound) added, same as the Time Table Generator.
- Footer now reads **CopyRight**.
- **Gear button (Admin)**: user guidelines, how to run in VS Code, devices, problems & fixes, deploy notes, and **Download project ZIP**.
- **50 KB rule**: details gzip-compressed; photo ~24 KB, signature ~10 KB; enforced on the server for every database write.
- **All devices**: responsive layout, safe-area support for notched phones, installable app (PWA) on Android/Pixel/iOS/macOS/Windows, downloads work on phones.
- **Single deployment on Vercel**: no separate backend. No local disk is used (Excel is built on demand, sessions are signed cookies).

## Run in VS Code
1. Install Node.js 18+ and VS Code. Unzip, **File -> Open Folder** `grt-student-app`.
2. Terminal: `npm install`
3. `copy .env.example .env` (Windows) or `cp .env.example .env`, set `ADMIN_PASSWORD`. Firebase is optional locally (without it, data is kept in `backend/data/local-db.json`).
4. `npm run dev` -> open http://localhost:5173
- Production style: `npm run build` then `npm start` -> http://localhost:5000. Windows: double-click `RUN.bat`; Mac/Linux: `bash RUN.sh`.

## Deploy
See `DEPLOY-ONE-TIME.md`. Environment variables: `JWT_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ADMIN_PASSWORD`.

## Access
Student: no password, Add Student only. Admin: default first password `grtcse@1234` (change it in the app; set `ADMIN_PASSWORD` to choose another).

## Layout
`api/index.js` Vercel entry - `backend/` Express app, `db.js` (50 KB rule), `store.js`, `excel.js` - `frontend/` React (Vite) -> `/dist` - `vercel.json`.
