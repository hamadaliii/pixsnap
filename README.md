# PixSnap — QR Event Photo Platform

A premium, QR-based event photo platform with face recognition.
Photographers create events → guests scan QR → upload selfie → see their photos.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend (Auth/DB/Storage) | Supabase |
| Face Recognition API | Python + FastAPI + DeepFace |

---

## Quick Start

### 1. Clone & Install Frontend

```bash
cd frontend
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → create a new project
2. Go to **SQL Editor** → run the SQL in `supabase/schema.sql`
3. Go to **Storage** → create two buckets:
   - `event-photos` (public)
   - `selfies` (public)
4. Copy your project URL and anon key

### 3. Configure Environment

```bash
cp frontend/.env.example frontend/.env.local
```

Fill in your Supabase values in `.env.local`.

### 4. Run Frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Run Python Face Recognition API

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Project Structure

```
pixsnap/
├── frontend/                  # Next.js app
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── auth/              # Login / Register
│   │   │   ├── dashboard/         # Photographer dashboard
│   │   │   ├── event/[id]/        # Public event page (QR destination)
│   │   │   ├── results/[id]/      # Photo results for guest
│   │   │   └── admin/[id]/        # Event admin (upload, QR, manage)
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # Supabase client, helpers
│   │   └── types/             # TypeScript types
│   └── .env.local             # Your secrets (never commit this)
│
├── backend/                   # Python face recognition API
│   ├── app/
│   │   └── main.py            # FastAPI app
│   └── requirements.txt
│
└── supabase/
    └── schema.sql             # Run this in Supabase SQL Editor
```

---

## How It Works

```
Photographer                    Guest
──────────                      ─────
1. Sign up / Login
2. Create Event
3. Get QR code              4. Scan QR code
4. Upload photos                5. See event page
                                6. Upload selfie
                            7. AI finds matching photos
                                8. View photo gallery
```

---

## Face Recognition Flow

1. Photographer uploads photos → frontend sends to Supabase Storage
2. Frontend calls Python API → DeepFace extracts face embeddings → stored in DB
3. Guest uploads selfie → Python API generates embedding
4. API runs cosine similarity → returns matching photo IDs
5. Frontend fetches and displays matched photos
