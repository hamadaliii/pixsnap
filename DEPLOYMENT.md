# Deployment Guide

This guide walks you through deploying PixSnap from your laptop to the internet.

---

## Architecture

```
Users → Vercel (Next.js frontend)
              ↕
         Supabase (database + storage + auth)
              ↕
         Railway (Python API)
```

All three services have generous free tiers.

---

## Step 1 — Deploy Supabase (already done if you followed the README)

1. Go to [supabase.com](https://supabase.com) → create project
2. Run `supabase/schema.sql` in the SQL Editor
3. Go to Storage → create two **public** buckets:
   - `event-photos`
   - `selfies`
4. Go to Project Settings → API and note:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (for backend only — never expose to browser)

---

## Step 2 — Deploy Python API to Railway

Railway is the easiest way to deploy Docker containers for free.

1. Create account at [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repo → set **Root Directory** to `backend`
4. Railway will auto-detect the Dockerfile
5. Go to **Variables** and add:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```
6. Deploy. Railway gives you a public URL like `https://pixsnap-backend.up.railway.app`
7. Copy this URL — you'll need it in Step 3

**Alternative: Render.com**
- New Web Service → connect repo → Root Directory: `backend`
- Runtime: Docker
- Add same environment variables

---

## Step 3 — Deploy Frontend to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Set **Root Directory** to `frontend`
4. Add these **Environment Variables** in Vercel:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | From Supabase settings |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase settings |
   | `NEXT_PUBLIC_API_URL` | Your Railway URL from Step 2 |

5. Click **Deploy**

Vercel gives you a URL like `https://pixsnap.vercel.app`

---

## Step 4 — Configure Supabase Auth Redirect

After deployment, tell Supabase where to redirect users after email confirmation:

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel URL: `https://pixsnap.vercel.app`
3. Add to **Redirect URLs**: `https://pixsnap.vercel.app/auth/callback`

---

## Step 5 — Test the full flow

1. Visit your Vercel URL
2. Register a photographer account
3. Create an event → get the QR code
4. Upload a few photos (Python API processes them in background)
5. Open the event URL on your phone (or scan the QR)
6. Upload a selfie → see your matched photos

---

## Troubleshooting

**"No face detected" errors**
- Ensure photos have clear, front-facing faces
- Try lowering `SIMILARITY_THRESHOLD` in `backend/app/main.py` to `0.45`
- Check Railway logs for detailed errors

**Photos not uploading**
- Verify Supabase Storage buckets are set to **public**
- Check RLS policies are applied (re-run schema.sql)

**Auth not working**
- Check Supabase redirect URLs include your Vercel domain
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and anon key are correct in Vercel

**Python API slow on first request**
- DeepFace downloads model weights (~500MB) on first use
- This is a one-time cost; subsequent requests are fast
- Railway free tier may sleep after inactivity — first request after sleep takes ~30s

---

## Local Development Checklist

```bash
# 1. Start Supabase (cloud) — just needs env vars in .env.local

# 2. Start Python API
cd backend
source venv/bin/activate
export $(cat .env | xargs)
uvicorn app.main:app --reload --port 8000

# 3. Start Next.js
cd frontend
npm run dev

# 4. Visit http://localhost:3000
```
