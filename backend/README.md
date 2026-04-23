# PixSnap — Python Face Recognition Backend

## Setup

### 1. Create a virtual environment (recommended)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> **Note**: The first install is large (~1.5GB) because TensorFlow and DeepFace
> download pre-trained model weights. This only happens once.

### 3. Configure environment

```bash
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY
```

Get your **service role** key from:
Supabase Dashboard → Project Settings → API → `service_role` (secret)

### 4. Run the API

```bash
# Load env vars and start server
export $(cat .env | xargs)
uvicorn app.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Test it:
```bash
curl http://localhost:8000
# → {"status":"ok","service":"PixSnap Face Recognition API"}
```

---

## API Reference

### `POST /embed`

Called automatically when a photographer uploads a photo.

```json
{
  "photo_id": "uuid-of-photo-row",
  "photo_url": "https://...supabase.co/storage/..."
}
```

Returns:
```json
{ "success": true, "photo_id": "..." }
```

---

### `POST /find`

Called when a guest submits their selfie.

```json
{
  "event_id": "uuid-of-event",
  "selfie_url": "https://...supabase.co/storage/..."
}
```

Returns:
```json
{
  "success": true,
  "matches": ["photo-uuid-1", "photo-uuid-2"]
}
```

---

## Tuning Face Recognition Accuracy

In `app/main.py`, adjust `SIMILARITY_THRESHOLD`:

| Value | Effect |
|-------|--------|
| `0.30` | Very strict — fewer false positives, may miss some |
| `0.40` | Balanced (default) |
| `0.50` | More permissive — finds more, may include false positives |

Lower = stricter matching.
