# One-time deployment on Vercel (single project)

Frontend (React) and backend (Express API) deploy **together as ONE Vercel project**:

- the React app is built into `/dist` and served as the website,
- the API lives in `api/index.js` and runs as one Vercel function (`/api/...`),
- the app calls `/api/...` on its own address, so there is nothing to connect between the two.

## Before you start (5 minutes)

1. A free account at https://vercel.com
2. Node.js 18+ (LTS) from https://nodejs.org
3. A Firebase project with **Firestore Database** created (Native mode) and its service-account key
   (Firebase console -> Project settings -> Service accounts -> Generate new private key).
   *No Firebase Storage bucket is needed* - photos and signatures are stored as tiny database items.

## Option A - upload with one command (no GitHub needed)

**Windows:** double-click `deploy-vercel.bat` - **macOS / Linux:** `bash deploy-vercel.sh` - or `npm run deploy`.
First time it asks you to log in to Vercel. Press **Enter** for every question (framework = Other).

## Option B - GitHub

Push the folder to GitHub (`.env` and the key file are already excluded), then Vercel -> **Add New -> Project** -> pick the repo -> **Deploy**.

## Environment variables (set once, then Redeploy)

Vercel -> project -> **Settings -> Environment Variables**:

| Name | Value |
|---|---|
| `JWT_SECRET` | any long random text: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the key as ONE line - run `npm run firebase-env` to print it |
| `ADMIN_PASSWORD` | first Admin password (change it inside the app afterwards) |

## Check it worked

Open `https://YOUR-APP.vercel.app/api/health` -> both checks `true`, `storage: "firestore"`.

## The 50 KB rule

Every item in the database is under **50 KB** (enforced in `backend/db.js`), and one student's whole record
(details + photo + signature) is under 50 KB (`backend/store.js`). Photos shrink to ~24 KB and signatures to ~10 KB
in the browser. Student details are gzip-compressed (about 1 KB each). Result: thousands of students fit in the free plan.

## Moving data from the previous version

`npm run migrate-legacy` (needs your Firebase key in `.env`/`backend/`) converts old records once. Images already small
enough are copied; bigger ones are listed so you can re-upload them from Admin -> Update.

## Updating later

Change the code, run the deploy file again (or `git push`). Replace `backend/assets/downloads/GRT-Student-App.zip`
with a fresh ZIP if you want the in-app download to match.
