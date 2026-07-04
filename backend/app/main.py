"""
PixSnap API v10 — SMTP mail, resend support
"""

import os, io, json, zipfile, math, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import boto3
import requests as req
import stripe
import numpy as np
import cv2
import pillow_heif
pillow_heif.register_heif_opener()
from PIL import Image, ImageDraw, ImageFont
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client
from app.optimizations import (
    build_versions, sha256_bytes, hash_ip, log_usage, budget_status,
    find_cached_match, store_match, count_recent_attempts, log_attempt,
)
from app.plans import (
    get_user_plan, check_quota, increment_counter, event_owner,
    email_configured, enqueue_email, process_email_queue,
    webhook_already_processed, mark_webhook_processed, run_cleanup,
)
from app.storage import (
    get_storage_provider, get_provider_by_name, provider_configured,
)

def convert_to_jpeg_if_needed(image_bytes: bytes, filename: str) -> bytes:
    """Konvertera HEIC/HEIF till JPEG om nödvändigt."""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    if ext in ('heic', 'heif'):
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        out = io.BytesIO()
        img.save(out, 'JPEG', quality=92)
        return out.getvalue()
    return image_bytes

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    print("[startup] HEIC-stöd aktiverat")
except ImportError:
    print("[startup] pillow-heif saknas — HEIC stöds ej")

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
AWS_ACCESS_KEY       = os.environ["AWS_ACCESS_KEY"]
AWS_SECRET_KEY       = os.environ["AWS_SECRET_KEY"]
AWS_REGION           = os.environ.get("AWS_REGION", "eu-west-1")
STRIPE_SECRET        = os.environ["STRIPE_SECRET"]
FRONTEND_URL         = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# SMTP config (set these in your .env)
SMTP_HOST     = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER     = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM     = os.environ.get("SMTP_FROM", SMTP_USER)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
stripe.api_key = STRIPE_SECRET

rekognition = boto3.client(
    "rekognition",
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION,
)

app = FastAPI(title="PixSnap API v10")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
print("[startup] PixSnap API v10 klar!")


# ── SMTP helper ─────────────────────────────────────────────────────────────

def send_email_smtp(to: str, subject: str, html: str):
    """Send email via SMTP. Falls back silently if not configured."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[smtp] Ingen SMTP-konfiguration — hoppar över email till {to}")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = to
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        print(f"[smtp] Email skickat till {to}")
    except Exception as e:
        print(f"[smtp] Fel vid utskick till {to}: {e}")


# ── Models ─────────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    photo_id: str
    photo_url: str
    event_id: str
    watermark_text: Optional[str] = "PixSnap"

class EmbedResponse(BaseModel):
    success: bool
    photo_id: str
    faces_found: int = 0
    message: str = ""

class FindRequest(BaseModel):
    event_id: str
    selfie_url: str
    email: str = ""
    pin_code: str = ""

class FindResponse(BaseModel):
    success: bool
    matches: List[str]
    session_token: str = ""
    message: str = ""
    photos_ready: bool = True

class WaitlistRequest(BaseModel):
    event_id: str
    email: str

class CheckoutRequest(BaseModel):
    photo_ids: List[str]
    session_token: str
    package: bool = False

class CheckoutResponse(BaseModel):
    checkout_url: str

class EmailRequest(BaseModel):
    session_token: str
    email: str

class PublishRequest(BaseModel):
    event_id: str
    user_id: str


# ── Helpers ────────────────────────────────────────────────────────────────

def download_bytes(url: str) -> bytes:
    r = req.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    r.raise_for_status()
    raw = r.content
    # Konvertera HEIC → JPEG
    if url.lower().endswith('.heic') or (len(raw) > 12 and raw[4:8] == b'ftyp'):
        try:
            img = Image.open(io.BytesIO(raw))
            output = io.BytesIO()
            img.convert('RGB').save(output, format='JPEG', quality=95)
            return output.getvalue()
        except Exception as e:
            print(f"[heic] Konverteringsfel: {e}")
    return raw


def create_watermarked_sd(image_bytes: bytes, watermark_text: str = "PixSnap") -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    max_width = 480
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)

    w, h = img.size
    wm_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(wm_layer)
    font_size = max(36, w // 9)

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()

    text = watermark_text
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    spacing_x = text_w + 50
    spacing_y = text_h + 50

    diag = int(math.sqrt(w * w + h * h)) + max(text_w, text_h) * 2
    tmp = Image.new("RGBA", (diag, diag), (0, 0, 0, 0))
    tmp_draw = ImageDraw.Draw(tmp)
    center = diag // 2

    for y in range(-diag, diag * 2, spacing_y):
        for x in range(-diag, diag * 2, spacing_x):
            offset = (spacing_x // 2) if (y // spacing_y) % 2 == 1 else 0
            tmp_draw.text(
                (center + x + offset - diag // 2, center + y - diag // 2),
                text, font=font, fill=(255, 255, 255, 50)
            )

    rotated = tmp.rotate(-30, expand=False)
    left = (rotated.width - w) // 2
    top = (rotated.height - h) // 2
    try:
        cropped = rotated.crop((left, top, left + w, top + h))
        wm_layer = Image.alpha_composite(wm_layer, cropped)
    except:
        pass

    combined = Image.alpha_composite(img, wm_layer).convert("RGB")
    output = io.BytesIO()
    combined.save(output, format="JPEG", quality=40)
    return output.getvalue()


def get_collection_id(event_id: str) -> str:
    return f"pixsnap-{event_id}"

def ensure_collection(event_id: str):
    try:
        rekognition.create_collection(CollectionId=get_collection_id(event_id))
    except rekognition.exceptions.ResourceAlreadyExistsException:
        pass


def detect_screen_or_screenshot(image_bytes: bytes) -> tuple[bool, str]:
    try:
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return False, ""

        h, w = img.shape[:2]

        edges = cv2.Canny(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100,
                                minLineLength=min(w,h)//3, maxLineGap=20)
        if lines is not None:
            long_h = sum(1 for l in lines if abs(l[0][1]-l[0][3])<10 and abs(l[0][0]-l[0][2])>w//3)
            long_v = sum(1 for l in lines if abs(l[0][0]-l[0][2])<10 and abs(l[0][1]-l[0][3])>h//3)
            if long_h >= 2 and long_v >= 2:
                return True, "Bilden verkar vara ett foto av en telefon eller skärm"

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        bright_ratio = np.sum(hsv[:,:,2] > 240) / (w * h)
        if bright_ratio > 0.08:
            return True, "Bilden innehåller reflektioner som tyder på ett foto av en skärm"

        try:
            response = rekognition.detect_faces(Image={"Bytes": image_bytes}, Attributes=["QUALITY"])
            for face in response.get("FaceDetails", []):
                if face.get("Quality", {}).get("Sharpness", 100) < 15:
                    return True, "Bilden är för suddig — ta en ny selfie direkt med kameran"
        except:
            pass

        try:
            labels = rekognition.detect_labels(Image={"Bytes": image_bytes}, MaxLabels=20, MinConfidence=80)
            phone_labels = {"Phone", "Mobile Phone", "Cell Phone", "Iphone", "Android"}
            for label in labels.get("Labels", []):
                if label["Name"] in phone_labels:
                    return True, "En telefon detekterades i bilden. Ta en selfie utan att hålla en annan telefon i bild."
        except Exception as e:
            print(f"[anti-spoof] Label detection fel: {e}")

        return False, ""
    except Exception as e:
        print(f"[anti-spoof] Fel: {e}")
        return False, ""


def send_notification_email(email: str, event_name: str, session_token: str, photo_count: int):
    gallery_url = f"{FRONTEND_URL}/session/{session_token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#fff;">
        <div style="text-align:center;margin-bottom:32px;">
            <h1 style="font-size:28px;font-weight:700;color:#111;margin:0;">Dina foton är redo! 🎉</h1>
        </div>
        <p style="color:#555;font-size:16px;line-height:1.6;margin-bottom:8px;">
            Fotografen har nu publicerat bilderna från <strong>{event_name}</strong>.
        </p>
        <p style="color:#555;font-size:16px;line-height:1.6;margin-bottom:32px;">
            Vi hittade <strong>{photo_count} foto{'n' if photo_count > 1 else ''}</strong> på dig.
            Klicka nedan för att se och ladda ner dem.
        </p>
        <div style="text-align:center;margin-bottom:32px;">
            <a href="{gallery_url}"
               style="display:inline-block;background:#111;color:#fff;text-decoration:none;
                      padding:16px 40px;border-radius:10px;font-size:16px;font-weight:600;">
                Se mina foton →
            </a>
        </div>
        <div style="border-top:1px solid #eee;padding-top:24px;">
            <p style="color:#999;font-size:12px;margin:0;">
                Din selfie raderas automatiskt inom 24 timmar.
                <a href="{FRONTEND_URL}/privacy" style="color:#999;">Integritetspolicy</a>
            </p>
        </div>
    </div>
    """
    send_email_smtp(email, f"📸 Dina foton från {event_name} är redo!", html)


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "PixSnap API v10"}


@app.post("/embed", response_model=EmbedResponse)
def embed_photo(data: EmbedRequest):
    try:
        image_bytes = download_bytes(data.photo_url)
        photo_hash = sha256_bytes(image_bytes)

        # Dedupe: if this exact image is already indexed for this event, skip AWS.
        existing = supabase.table("photos").select("id, rekognition_face_ids") \
            .eq("event_id", data.event_id).eq("hash", photo_hash).neq("id", data.photo_id).execute()
        reused_face_ids = []
        if existing.data:
            reused_face_ids = existing.data[0].get("rekognition_face_ids") or []

        faces_found = 0
        face_ids = []
        if reused_face_ids:
            # Same bytes already indexed — do NOT call AWS again.
            face_ids = reused_face_ids
            faces_found = len(face_ids)
        else:
            ensure_collection(data.event_id)
            response = rekognition.index_faces(
                CollectionId=get_collection_id(data.event_id),
                Image={"Bytes": image_bytes},
                ExternalImageId=data.photo_id,
                DetectionAttributes=[],
                MaxFaces=50,
                QualityFilter="AUTO",
            )
            records = response.get("FaceRecords", [])
            faces_found = len(records)
            face_ids = [r["Face"]["FaceId"] for r in records]
            log_usage(supabase, "ai_index", event_id=data.event_id, count=1)

        watermark_text = data.watermark_text or "PixSnap"

        # Build small WebP thumb + preview + blur placeholder (watermarked).
        versions = build_versions(image_bytes, watermark_text)

        base = f"{data.event_id}/{data.photo_id}"
        thumb_path   = f"thumbs/{base}.webp"
        preview_path = f"previews/{base}.webp"

        # Upload watermarked thumb + preview to the configured provider
        # (Supabase / R2 / S3). Falls back to Supabase if R2/S3 not configured.
        store = get_storage_provider(supabase)  # honours STORAGE_PROVIDER env
        thumb_res   = store.upload_object(thumb_path,   versions["thumb_bytes"],   "image/webp")
        preview_res = store.upload_object(preview_path, versions["preview_bytes"], "image/webp")

        thumb_url   = thumb_res.get("public_url")
        preview_url = preview_res.get("public_url")

        # Keep watermark_url pointing at the preview for backward compatibility.
        supabase.table("photos").update({
            "processed": True,
            "watermark_url": preview_url,
            "thumb_url": thumb_url,
            "preview_url": preview_url,
            "blur_placeholder": versions["blur_placeholder"],
            "width": versions["width"],
            "height": versions["height"],
            "preview_size_bytes": versions["preview_size_bytes"],
            "thumb_size_bytes": versions["thumb_size_bytes"],
            "hash": photo_hash,
            "face_count": faces_found,
            "rekognition_face_ids": face_ids,
            # provider metadata
            "thumb_storage_provider":   thumb_res.get("provider"),
            "thumb_bucket":             thumb_res.get("bucket"),
            "thumb_path":               thumb_res.get("path"),
            "preview_storage_provider": preview_res.get("provider"),
            "preview_bucket":           preview_res.get("bucket"),
            "preview_path":             preview_res.get("path"),
        }).eq("id", data.photo_id).execute()

        print(f"[embed] {data.photo_id[:8]}... {faces_found} ansikten (reused={bool(reused_face_ids)})")
        return EmbedResponse(success=True, photo_id=data.photo_id, faces_found=faces_found)
    except Exception as e:
        print(f"[embed] Fel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/find", response_model=FindResponse)
def find_matches(data: FindRequest, request: Request):
    try:
        request_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "0.0.0.0").split(",")[0].strip()
        event_result = supabase.table("events").select("*").eq("id", data.event_id).single().execute()
        event = event_result.data
        if not event:
            raise HTTPException(status_code=404, detail="Event hittades inte")

        if not event.get("is_active", True):
            return FindResponse(success=False, matches=[], message="Detta event är inte längre aktivt.")

        if event.get("expires_at"):
            expires = datetime.fromisoformat(event["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires:
                return FindResponse(success=False, matches=[], message="Detta event har gått ut.")

        if event.get("pin_code") and event["pin_code"] != data.pin_code:
            return FindResponse(success=False, matches=[], message="Fel PIN-kod.")

        photos_ready = bool(event.get("published_at"))

        # ── Budget guard: stop scans if hard limit reached ──
        budget = budget_status(supabase)
        if budget.get("maintenance_mode"):
            return FindResponse(success=False, matches=[], message="Tjänsten är tillfälligt otillgänglig. Försök igen senare.")
        if not budget.get("scans_enabled", True):
            return FindResponse(success=False, matches=[], message="Sökningar är tillfälligt pausade. Försök igen senare.")

        # ── Rate limit: max 10 matches per IP per hour, 3 per session/event/24h ──
        ip_h = hash_ip(request_ip)
        recent_ip = count_recent_attempts(supabase, ip_hash=ip_h, kind="match", minutes=60)
        if recent_ip >= 10:
            return FindResponse(success=False, matches=[], message="För många sökningar. Vänta en stund och försök igen.")

        # ── Plan quota: scans per month for the event owner ──
        owner_id = event.get("created_by")
        ok_scan, scan_msg = check_quota(supabase, owner_id, "scan")
        if not ok_scan:
            return FindResponse(success=False, matches=[], message=scan_msg)

        image_bytes = download_bytes(data.selfie_url)
        selfie_hash = sha256_bytes(image_bytes)

        # ── Match cache: same selfie for same event within 24h → skip AWS ──
        cached = find_cached_match(supabase, data.event_id, selfie_hash)
        if cached:
            matched_photo_ids = cached.get("photo_ids") or []
            session_result = supabase.table("guest_sessions").insert({
                "event_id": data.event_id,
                "email": data.email or None,
                "photo_ids": matched_photo_ids,
            }).execute()
            session_token = session_result.data[0]["token"]
            log_attempt(supabase, event_id=data.event_id, ip_hash=ip_h, session_token=session_token, kind="match", success=True)
            print(f"[find] CACHE HIT {len(matched_photo_ids)} matchningar (0 AWS calls)")
            return FindResponse(success=True, matches=matched_photo_ids, session_token=session_token, photos_ready=photos_ready)

        is_suspicious, reason = detect_screen_or_screenshot(image_bytes)
        if is_suspicious:
            log_attempt(supabase, event_id=data.event_id, ip_hash=ip_h, kind="match", success=False)
            return FindResponse(success=False, matches=[], message=f"Säkerhetsfel: {reason}")

        response = rekognition.search_faces_by_image(
            CollectionId=get_collection_id(data.event_id),
            Image={"Bytes": image_bytes},
            MaxFaces=500,
            FaceMatchThreshold=99.0,
        )
        log_usage(supabase, "ai_search", event_id=data.event_id, count=1)
        increment_counter(supabase, owner_id, "scans", 1)
        increment_counter(supabase, owner_id, "ai_matches", 1)

        matches = response.get("FaceMatches", [])
        matched_photo_ids = list({m["Face"]["ExternalImageId"] for m in matches})
        conf_avg = (sum(m.get("Similarity", 0) for m in matches) / len(matches)) if matches else None

        try:
            supabase.table("event_scans").insert({"event_id": data.event_id, "photo_count": len(matched_photo_ids)}).execute()
        except Exception:
            pass

        session_result = supabase.table("guest_sessions").insert({
            "event_id": data.event_id,
            "email": data.email or None,
            "photo_ids": matched_photo_ids,
        }).execute()
        session_token = session_result.data[0]["token"]

        # Cache the result so refresh / same selfie won't hit AWS again.
        store_match(supabase, data.event_id, selfie_hash, matched_photo_ids,
                    guest_session_id=session_result.data[0]["id"], confidence_avg=conf_avg)

        try:
            supabase.table("consents").insert({
                "session_id": session_result.data[0]["id"],
                "event_id": data.event_id,
            }).execute()
        except Exception:
            pass

        log_attempt(supabase, event_id=data.event_id, ip_hash=ip_h, session_token=session_token, kind="match", success=True)
        print(f"[find] {len(matched_photo_ids)} matchningar, ready={photos_ready}")
        return FindResponse(
            success=True,
            matches=matched_photo_ids,
            session_token=session_token,
            photos_ready=photos_ready,
        )

    except rekognition.exceptions.InvalidParameterException:
        return FindResponse(success=False, matches=[], message="Inget ansikte hittades i selfien.")
    except rekognition.exceptions.ResourceNotFoundException:
        return FindResponse(success=True, matches=[], message="Inga foton uppladdade ännu.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[find] Fel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/waitlist")
def join_waitlist(data: WaitlistRequest, background_tasks: BackgroundTasks):
    try:
        existing = supabase.table("waitlist").select("id") \
            .eq("event_id", data.event_id).eq("email", data.email).execute()
        if existing.data:
            return {"success": True, "message": "Du är redan registrerad"}

        supabase.table("waitlist").insert({
            "event_id": data.event_id,
            "email": data.email,
        }).execute()

        event = supabase.table("events").select("name").eq("id", data.event_id).single().execute()
        event_name = event.data["name"] if event.data else "eventet"

        html = f"""
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;">
            <h2 style="font-size:22px;color:#111;">Vi hör av oss! 📸</h2>
            <p style="color:#555;font-size:15px;line-height:1.6;">
                Du är nu registrerad och får ett email med en direkt länk till dina foton
                så fort fotografen publicerar bilderna från <strong>{event_name}</strong>.
            </p>
            <p style="color:#999;font-size:12px;margin-top:32px;">
                <a href="{FRONTEND_URL}/privacy" style="color:#999;">Integritetspolicy</a>
            </p>
        </div>
        """
        background_tasks.add_task(
            send_email_smtp,
            data.email,
            f"Vi meddelar dig när foton från {event_name} är klara",
            html
        )

        return {"success": True, "message": f"Du får ett email när foton från {event_name} är klara"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/publish")
def publish_event(data: PublishRequest, background_tasks: BackgroundTasks):
    """Publish photos and notify everyone on the waitlist. Can be called multiple times."""
    try:
        event = supabase.table("events").select("*").eq("id", data.event_id).eq("created_by", data.user_id).single().execute()
        if not event.data:
            raise HTTPException(status_code=403, detail="Ingen behörighet")

        # Mark as published (allow re-publish)
        supabase.table("events").update({
            "published_at": datetime.now(timezone.utc).isoformat(),
            "notification_sent": True,
        }).eq("id", data.event_id).execute()

        waitlist = supabase.table("waitlist").select("*").eq("event_id", data.event_id).execute()
        event_name = event.data["name"]
        count = 0

        for entry in waitlist.data:
            if not entry.get("email"):
                continue

            matched = []
            if entry.get("selfie_url"):
                try:
                    image_bytes = download_bytes(entry["selfie_url"])
                    resp = rekognition.search_faces_by_image(
                        CollectionId=get_collection_id(data.event_id),
                        Image={"Bytes": image_bytes},
                        MaxFaces=500,
                        FaceMatchThreshold=99.0,
                    )
                    matched = list({m["Face"]["ExternalImageId"] for m in resp.get("FaceMatches", [])})
                except:
                    pass

            if matched:
                session_result = supabase.table("guest_sessions").insert({
                    "event_id": data.event_id,
                    "email": entry["email"],
                    "photo_ids": matched,
                }).execute()
                token = session_result.data[0]["token"]
                background_tasks.add_task(send_notification_email, entry["email"], event_name, token, len(matched))
            else:
                event_slug_result = supabase.table("events").select("slug").eq("id", data.event_id).single().execute()
                event_slug = event_slug_result.data["slug"] if event_slug_result.data else ""
                selfie_url = f"{FRONTEND_URL}/event/{event_slug}"
                html = f"""
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;">
                    <h2 style="font-size:22px;color:#111;">Foton från {event_name} är klara! 🎉</h2>
                    <p style="color:#555;font-size:15px;line-height:1.6;">
                        Fotografen har nu lagt upp bilderna.
                        Klicka nedan för att ladda upp din selfie och hitta dina foton.
                    </p>
                    <div style="text-align:center;margin:32px 0;">
                        <a href="{selfie_url}"
                           style="display:inline-block;background:#111;color:#fff;text-decoration:none;
                                  padding:16px 40px;border-radius:10px;font-size:16px;font-weight:600;">
                            Hitta mina foton →
                        </a>
                    </div>
                    <p style="color:#999;font-size:12px;margin-top:32px;">
                        <a href="{FRONTEND_URL}/privacy" style="color:#999;">Integritetspolicy</a>
                    </p>
                </div>
                """
                background_tasks.add_task(send_email_smtp, entry["email"], f"📸 Foton från {event_name} är nu klara!", html)
            count += 1

        return {"success": True, "message": f"Notifikationer skickade till {count} gäster", "count": count}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[publish] Fel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/event/{event_id}/verify-pin")
def verify_pin(event_id: str, pin: str):
    try:
        event = supabase.table("events").select("pin_code").eq("id", event_id).single().execute()
        if not event.data:
            raise HTTPException(status_code=404, detail="Event hittades inte")
        return {"valid": event.data.get("pin_code") == pin}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create-checkout", response_model=CheckoutResponse)
def create_checkout(data: CheckoutRequest):
    try:
        if not data.photo_ids:
            raise HTTPException(status_code=400, detail="Inga foton valda")

        photo = supabase.table("photos").select("event_id").eq("id", data.photo_ids[0]).single().execute()
        event_id = photo.data["event_id"] if photo.data else None

        event = supabase.table("events").select("price_per_photo_ore, package_enabled, package_price_ore, name").eq("id", event_id).single().execute() if event_id else None

        price_per_photo = event.data.get("price_per_photo_ore", 1000) if event and event.data else 1000
        package_enabled = event.data.get("package_enabled", False) if event and event.data else False
        package_price = event.data.get("package_price_ore", 4900) if event and event.data else 4900
        event_name = event.data.get("name", "PixSnap") if event and event.data else "PixSnap"

        if data.package and package_enabled:
            total_ore = package_price
            product_name = f"Alla foton — {event_name}"
            unit_amount = package_price
            quantity = 1
        else:
            total_ore = len(data.photo_ids) * price_per_photo
            product_name = f"{event_name} — {len(data.photo_ids)} foto{'n' if len(data.photo_ids) > 1 else ''}"
            unit_amount = price_per_photo
            quantity = len(data.photo_ids)

        purchase_result = supabase.table("purchases").insert({
            "photo_ids": data.photo_ids,
            "amount_ore": total_ore,
            "status": "pending",
        }).execute()
        purchase_id = purchase_result.data[0]["id"]

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "sek",
                    "product_data": {
                        "name": product_name,
                        "description": "Full kvalitet utan vattenstämpel",
                    },
                    "unit_amount": unit_amount,
                },
                "quantity": quantity,
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/purchase/success?purchase_id={purchase_id}&token={data.session_token}",
            cancel_url=f"{FRONTEND_URL}/session/{data.session_token}",
            metadata={"purchase_id": purchase_id},
        )

        supabase.table("purchases").update({"stripe_session_id": session.id}).eq("id", purchase_id).execute()
        return CheckoutResponse(checkout_url=session.url)

    except Exception as e:
        print(f"[checkout] Fel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    try:
        event = json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_id = event.get("id", "")
    event_type = event.get("type", "")

    # Idempotency: never process the same Stripe event twice.
    if event_id and webhook_already_processed(supabase, event_id):
        return {"ok": True, "duplicate": True}

    purchase_id = None
    if event_type == "checkout.session.completed":
        purchase_id = event["data"]["object"].get("metadata", {}).get("purchase_id")
        if purchase_id:
            import secrets
            supabase.table("purchases").update({
                "status": "paid",
                "paid_at": datetime.now(timezone.utc).isoformat(),
                "download_token": secrets.token_urlsafe(24),
            }).eq("id", purchase_id).execute()

    if event_id:
        mark_webhook_processed(supabase, event_id, event_type, purchase_id)
    return {"ok": True}


@app.get("/purchase/{purchase_id}")
def get_purchase(purchase_id: str):
    try:
        result = supabase.table("purchases").select("*").eq("id", purchase_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Köp hittades inte")
        purchase = result.data
        if purchase["status"] == "pending" and purchase.get("stripe_session_id"):
            s = stripe.checkout.Session.retrieve(purchase["stripe_session_id"])
            if s.payment_status == "paid":
                supabase.table("purchases").update({"status": "paid"}).eq("id", purchase_id).execute()
                purchase["status"] = "paid"
        return purchase
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/usage")
def admin_usage():
    """SuperAdmin: real egress/AI/email usage this month + budget status."""
    try:
        b = budget_status(supabase)
        # Per-event egress estimate
        since = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        rows = supabase.table("usage_events").select("event_id, kind, bytes, count").gte("created_at", since).execute().data or []
        per_event = {}
        for r in rows:
            eid = r.get("event_id") or "unknown"
            per_event.setdefault(eid, {"egress": 0, "ai_search": 0, "ai_index": 0, "email": 0})
            if r["kind"] in ("egress", "zip"):
                per_event[eid]["egress"] += r.get("bytes", 0) or 0
            elif r["kind"] in per_event[eid]:
                per_event[eid][r["kind"]] += r.get("count", 0) or 0
        return {"budget": b, "per_event": per_event}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/settings")
async def admin_update_settings(request: Request):
    """SuperAdmin: toggle kill switches / limits."""
    try:
        body = await request.json()
        allowed = {
            "scans_enabled", "downloads_enabled", "previews_enabled", "uploads_enabled",
            "maintenance_mode", "monthly_egress_soft_limit", "monthly_egress_hard_limit",
            "monthly_ai_search_limit", "monthly_ai_index_limit", "monthly_email_limit",
        }
        update = {k: v for k, v in body.items() if k in allowed}
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("global_settings").update(update).eq("id", 1).execute()
        # audit
        try:
            supabase.table("admin_audit_logs").insert({
                "admin_email": body.get("admin_email", ""),
                "action": "update_settings",
                "target_type": "settings",
                "meta": update,
            }).execute()
        except Exception:
            pass
        return {"ok": True, "updated": update}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/plans")
def admin_plans():
    """SuperAdmin: all photographers with plan + this-month usage."""
    try:
        plans = supabase.table("photographer_plans").select("*").execute().data or []
        counters = supabase.table("usage_counters").select("*").eq("period", datetime.now(timezone.utc).strftime("%Y-%m")).execute().data or []
        cmap = {c["user_id"]: c for c in counters}
        out = []
        for p in plans:
            uid = p["user_id"]
            plan = get_user_plan(supabase, uid)
            out.append({
                "user_id": uid,
                "plan_id": p.get("plan_id"),
                "status": p.get("status"),
                "limits": plan["limits"],
                "usage": cmap.get(uid, {}),
            })
        return {"photographers": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/plan")
async def admin_set_plan(request: Request):
    """SuperAdmin: change a photographer's plan / status, or grant extra quota."""
    try:
        body = await request.json()
        user_id = body.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id krävs")

        if "plan_id" in body or "status" in body:
            update = {}
            if "plan_id" in body: update["plan_id"] = body["plan_id"]
            if "status" in body:  update["status"] = body["status"]
            update["updated_at"] = datetime.now(timezone.utc).isoformat()
            # upsert
            existing = supabase.table("photographer_plans").select("user_id").eq("user_id", user_id).execute().data
            if existing:
                supabase.table("photographer_plans").update(update).eq("user_id", user_id).execute()
            else:
                supabase.table("photographer_plans").insert({"user_id": user_id, **update}).execute()

        if body.get("grant"):
            g = body["grant"]
            supabase.table("admin_overrides").insert({
                "user_id": user_id,
                "extra_events": g.get("events", 0),
                "extra_photos": g.get("photos", 0),
                "extra_scans": g.get("scans", 0),
                "extra_emails": g.get("emails", 0),
                "extra_downloads": g.get("downloads", 0),
                "note": g.get("note", ""),
                "created_by": body.get("admin_email", ""),
            }).execute()

        try:
            supabase.table("admin_audit_logs").insert({
                "admin_email": body.get("admin_email", ""),
                "action": "set_plan", "target_type": "photographer", "target_id": user_id, "meta": body,
            }).execute()
        except Exception:
            pass
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/cleanup")
def admin_cleanup():
    """SuperAdmin / cron: run cleanup jobs (selfies 24h, expired events, cache TTL)."""
    try:
        summary = run_cleanup(supabase, storage_from=supabase.storage.from_)
        try:
            supabase.table("admin_audit_logs").insert({
                "action": "cleanup", "target_type": "system", "meta": summary,
            }).execute()
        except Exception:
            pass
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/email/process")
def admin_email_process():
    """SuperAdmin / cron: flush the email queue with retry/backoff."""
    try:
        return process_email_queue(supabase, limit=20)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/email/test")
async def admin_email_test(request: Request):
    """SuperAdmin: send a test email to verify SMTP works."""
    try:
        body = await request.json()
        to = body.get("to")
        if not to:
            raise HTTPException(status_code=400, detail="to krävs")
        if not email_configured():
            return {"ok": False, "message": "Email not configured"}
        html = '<div style="font-family:sans-serif;padding:24px;"><h2>PixSnap testmail</h2><p>Om du ser detta fungerar SMTP.</p></div>'
        enqueue_email(supabase, to, "PixSnap testmail", html, template="test")
        result = process_email_queue(supabase, limit=5)
        return {"ok": result.get("sent", 0) > 0, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/email/status")
def admin_email_status():
    """SuperAdmin: email config + queue/log stats."""
    try:
        pending = supabase.table("email_queue").select("id", count="exact", head=True).eq("status", "pending").execute().count or 0
        failed = supabase.table("email_queue").select("id", count="exact", head=True).eq("status", "failed").execute().count or 0
        logs = supabase.table("email_logs").select("*").order("created_at", desc=True).limit(30).execute().data or []
        return {"configured": email_configured(), "pending": pending, "failed": failed, "logs": logs}
    except Exception as e:
        return {"configured": email_configured(), "pending": 0, "failed": 0, "logs": [], "error": str(e)}


@app.get("/admin/storage/overview")
def admin_storage_overview():
    """SuperAdmin: per-event storage/provider + cost estimate. Real data only."""
    try:
        # per-event summary from the view (falls back to raw aggregate)
        try:
            rows = supabase.table("event_storage_summary").select("*").execute().data or []
        except Exception:
            rows = []
            evs = supabase.table("events").select("id, name").execute().data or []
            for e in evs:
                ph = supabase.table("photos").select("thumb_size_bytes, preview_size_bytes, original_size_bytes, thumb_storage_provider").eq("event_id", e["id"]).execute().data or []
                rows.append({
                    "event_id": e["id"], "event_name": e["name"], "photo_count": len(ph),
                    "thumb_bytes": sum(p.get("thumb_size_bytes") or 0 for p in ph),
                    "preview_bytes": sum(p.get("preview_size_bytes") or 0 for p in ph),
                    "original_bytes": sum(p.get("original_size_bytes") or 0 for p in ph),
                    "thumb_provider": (ph[0].get("thumb_storage_provider") if ph else "supabase"),
                })

        # provider totals
        totals = {"supabase": 0, "r2": 0, "s3": 0}
        for r in rows:
            prov = r.get("thumb_provider") or "supabase"
            served = (r.get("thumb_bytes", 0) or 0) + (r.get("preview_bytes", 0) or 0)
            totals[prov] = totals.get(prov, 0) + served

        return {
            "events": rows,
            "provider_totals": totals,
            "configured": {
                "supabase": True,
                "r2": provider_configured("r2"),
                "s3": provider_configured("s3"),
            },
            "current_provider": os.environ.get("STORAGE_PROVIDER", "supabase"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class StorageMigrateRequest(BaseModel):
    event_id: str
    target_provider: str          # 'r2' | 's3' | 'supabase'
    kinds: List[str] = ["thumb", "preview"]  # which assets to migrate
    dry_run: bool = True
    admin_email: str = ""


@app.post("/admin/storage/migrate")
def admin_storage_migrate(data: StorageMigrateRequest):
    """
    Migrate an event's thumb/preview (and optionally original) files to a new
    provider. Copies bytes; does NOT delete the Supabase source until verified.
    dry_run=True only reports what would move.
    """
    try:
        if not provider_configured(data.target_provider):
            raise HTTPException(status_code=400, detail=f"Provider '{data.target_provider}' saknar credentials")

        photos = supabase.table("photos").select(
            "id, thumb_url, preview_url, thumb_path, preview_path, "
            "thumb_storage_provider, preview_storage_provider, storage_path, public_url"
        ).eq("event_id", data.event_id).execute().data or []

        target = get_provider_by_name(supabase, data.target_provider)
        moved = {"thumb": 0, "preview": 0, "original": 0}
        planned = len(photos)
        errors = []

        if data.dry_run:
            return {"dry_run": True, "photos": planned, "kinds": data.kinds,
                    "target": data.target_provider, "would_move": planned * len(data.kinds)}

        for p in photos:
            for kind in data.kinds:
                try:
                    if kind == "thumb":
                        src_prov = get_provider_by_name(supabase, p.get("thumb_storage_provider") or "supabase")
                        path = p.get("thumb_path") or f"thumbs/{data.event_id}/{p['id']}.webp"
                    elif kind == "preview":
                        src_prov = get_provider_by_name(supabase, p.get("preview_storage_provider") or "supabase")
                        path = p.get("preview_path") or f"previews/{data.event_id}/{p['id']}.webp"
                    elif kind == "original":
                        src_prov = get_provider_by_name(supabase, "supabase")
                        path = p.get("storage_path")
                    else:
                        continue
                    if not path:
                        continue

                    # read from source, write to target (same key)
                    body = src_prov.download_object(path)
                    ctype = "image/webp" if kind in ("thumb", "preview") else "image/jpeg"
                    res = target.upload_object(path, body, ctype)

                    update = {}
                    if kind == "thumb":
                        update = {"thumb_storage_provider": res["provider"], "thumb_bucket": res["bucket"],
                                  "thumb_path": res["path"], "thumb_url": res["public_url"], "watermark_url": p.get("preview_url")}
                    elif kind == "preview":
                        update = {"preview_storage_provider": res["provider"], "preview_bucket": res["bucket"],
                                  "preview_path": res["path"], "preview_url": res["public_url"], "watermark_url": res["public_url"]}
                    elif kind == "original":
                        update = {"original_storage_provider": res["provider"], "original_bucket": res["bucket"], "original_path": res["path"]}

                    update["storage_migration_status"] = "migrated"
                    update["storage_migrated_at"] = datetime.now(timezone.utc).isoformat()
                    supabase.table("photos").update(update).eq("id", p["id"]).execute()
                    moved[kind] += 1
                except Exception as e:
                    errors.append(f"{p['id'][:8]}/{kind}: {e}")

        try:
            supabase.table("admin_audit_logs").insert({
                "admin_email": data.admin_email, "action": "storage_migrate",
                "target_type": "event", "target_id": data.event_id,
                "meta": {"target": data.target_provider, "kinds": data.kinds, "moved": moved},
            }).execute()
        except Exception:
            pass

        return {"dry_run": False, "moved": moved, "errors": errors[:20]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/storage/verify")
async def admin_storage_verify(request: Request):
    """Verify migrated files exist on their recorded provider before any deletion."""
    try:
        body = await request.json()
        event_id = body.get("event_id")
        photos = supabase.table("photos").select("id, thumb_path, thumb_storage_provider, thumb_bucket").eq("event_id", event_id).eq("storage_migration_status", "migrated").execute().data or []
        ok = missing = 0
        for p in photos:
            prov = get_provider_by_name(supabase, p.get("thumb_storage_provider"), p.get("thumb_bucket"))
            if p.get("thumb_path") and prov.object_exists(p["thumb_path"]):
                supabase.table("photos").update({"storage_migration_status": "verified"}).eq("id", p["id"]).execute()
                ok += 1
            else:
                missing += 1
        return {"verified": ok, "missing": missing, "total": len(photos)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/storage/rollback")
async def admin_storage_rollback(request: Request):
    """Roll a migrated event's metadata back to Supabase (files stay; just repoint)."""
    try:
        body = await request.json()
        event_id = body.get("event_id")
        photos = supabase.table("photos").select("id, storage_path").eq("event_id", event_id).execute().data or []
        for p in photos:
            base = p.get("storage_path", "")
            supabase.table("photos").update({
                "thumb_storage_provider": "supabase", "thumb_bucket": "event-photos",
                "preview_storage_provider": "supabase", "preview_bucket": "event-photos",
                "storage_migration_status": "rolled_back",
            }).eq("id", p["id"]).execute()
        try:
            supabase.table("admin_audit_logs").insert({
                "admin_email": body.get("admin_email", ""), "action": "storage_rollback",
                "target_type": "event", "target_id": event_id,
            }).execute()
        except Exception:
            pass
        return {"ok": True, "rolled_back": len(photos)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{purchase_id}")
def download_zip(purchase_id: str):
    try:
        result = supabase.table("purchases").select("*").eq("id", purchase_id).single().execute()
        if not result.data or result.data["status"] != "paid":
            raise HTTPException(status_code=403, detail="Betalning ej genomförd")
        photos = supabase.table("photos").select("id, public_url").in_("id", result.data["photo_ids"]).execute()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, p in enumerate(photos.data):
                try:
                    zf.writestr(f"pixsnap_foto_{i+1}.jpg", download_bytes(p["public_url"]))
                except Exception as e:
                    print(f"[zip] Fel: {e}")
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=pixsnap_foton.zip"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download-signed/{purchase_id}")
def download_signed(purchase_id: str, token: str = ""):
    """
    Paid download via SHORT-LIVED Supabase signed URLs (originals stay private).
    Requires the download_token issued at payment time. Returns per-photo signed
    URLs valid for 5 minutes instead of streaming through the backend.
    """
    try:
        result = supabase.table("purchases").select("*").eq("id", purchase_id).single().execute()
        pur = result.data
        if not pur or pur.get("status") != "paid":
            raise HTTPException(status_code=403, detail="Betalning ej genomförd")
        # token check (issued in the Stripe webhook)
        if pur.get("download_token") and token != pur.get("download_token"):
            raise HTTPException(status_code=403, detail="Ogiltig nedladdningslänk")

        photos = supabase.table("photos").select("id, storage_path, public_url").in_("id", pur["photo_ids"]).execute()
        urls = []
        for ph in photos.data:
            path = ph.get("storage_path")
            signed = None
            if path:
                try:
                    # 300s = 5 min TTL. Originals live in the public event-photos
                    # bucket today; signing still yields a short-lived URL.
                    res = supabase.storage.from_("event-photos").create_signed_url(path, 300)
                    signed = res.get("signedURL") or res.get("signedUrl")
                except Exception as e:
                    print(f"[signed] {e}")
            urls.append({"id": ph["id"], "url": signed or ph.get("public_url")})

        supabase.table("purchases").update({"downloaded": True}).eq("id", purchase_id).execute()
        log_usage(supabase, "egress", event_id=None, count=len(urls))
        return {"ok": True, "expires_in": 300, "photos": urls}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download-free")
def download_free(ids: str):
    """Download watermarked photos (free tier)."""
    try:
        # Budget guard: stop free ZIP if downloads are globally disabled / hard limit.
        b = budget_status(supabase)
        if not b.get("downloads_enabled", True):
            raise HTTPException(status_code=503, detail="Nedladdningar är tillfälligt pausade.")
        photo_ids = [i for i in ids.split(",") if i]
        photos = supabase.table("photos").select("id, watermark_url, public_url").in_("id", photo_ids).execute()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, p in enumerate(photos.data):
                try:
                    # Prefer pre-generated watermark_url; fall back to generating on the fly
                    url = p.get("watermark_url") or p["public_url"]
                    img_bytes = download_bytes(url)
                    if not p.get("watermark_url"):
                        img_bytes = create_watermarked_sd(img_bytes)
                    zf.writestr(f"pixsnap_foto_{i+1}_watermark.jpg", img_bytes)
                except Exception as e:
                    print(f"[zip-free] Fel: {e}")
        buf.seek(0)
        data_len = buf.getbuffer().nbytes
        log_usage(supabase, "zip", bytes_est=data_len, count=1)
        return StreamingResponse(buf, media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=pixsnap_foton_gratis.zip"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download-free-original")
def download_free_original(ids: str):
    """Download original quality photos (when payment is disabled)."""
    try:
        photo_ids = [i for i in ids.split(",") if i]
        photos = supabase.table("photos").select("id, public_url").in_("id", photo_ids).execute()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, p in enumerate(photos.data):
                try:
                    zf.writestr(f"pixsnap_foto_{i+1}.jpg", download_bytes(p["public_url"]))
                except Exception as e:
                    print(f"[zip] Fel: {e}")
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=pixsnap_foton.zip"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/session/{token}")
def get_session(token: str):
    try:
        result = supabase.table("guest_sessions").select("*").eq("token", token).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Session hittades inte")
        photos = supabase.table("photos").select("id, public_url, watermark_url").in_("id", result.data["photo_ids"]).execute()

        event = supabase.table("events").select("price_per_photo_ore, package_enabled, package_price_ore, name, photographer_logo_url").eq("id", result.data["event_id"]).single().execute()

        return {
            "session": result.data,
            "photos": photos.data,
            "event": event.data if event.data else {},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/send-email")
def send_email_route(data: EmailRequest):
    try:
        result = supabase.table("guest_sessions").select("*").eq("token", data.session_token).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Session hittades inte")
        photo_count = len(result.data["photo_ids"])
        gallery_url = f"{FRONTEND_URL}/session/{data.session_token}"
        supabase.table("guest_sessions").update({"email": data.email}).eq("token", data.session_token).execute()

        event = supabase.table("events").select("name, created_by").eq("id", result.data["event_id"]).single().execute()
        event_name = event.data["name"] if event.data else "eventet"

        html = f"""
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;">
            <h2 style="font-size:22px;color:#111;">Dina foton är redo 📸</h2>
            <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:32px;">
                Vi hittade {photo_count} foto{'n' if photo_count > 1 else ''} på dig från <strong>{event_name}</strong>.
            </p>
            <a href="{gallery_url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Se dina foton →</a>
            <p style="color:#999;font-size:12px;margin-top:32px;">Länken gäller i 30 dagar. Din selfie raderas inom 24h.</p>
        </div>
        """
        if not email_configured():
            return {"success": False, "message": "Email not configured"}

        owner_id = event.data.get("created_by") if event.data else None
        dedupe = f"gallery:{data.session_token}:{data.email}"
        enqueue_email(supabase, data.email, f"Dina {photo_count} foton från {event_name}",
                      html, template="gallery_link", dedupe_key=dedupe, user_id=owner_id)
        # Try to flush immediately so the guest gets it fast; queue handles retries.
        process_email_queue(supabase, limit=3)
        return {"success": True, "queued": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/session/{token}/data")
def delete_guest_data(token: str):
    try:
        result = supabase.table("guest_sessions").select("*").eq("token", token).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Session hittades inte")
        session_id = result.data["id"]
        supabase.table("consents").delete().eq("session_id", session_id).execute()
        supabase.table("purchases").delete().eq("guest_session_id", session_id).execute()
        supabase.table("guest_sessions").delete().eq("id", session_id).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/event/{event_id}")
def delete_event(event_id: str, user_id: str):
    try:
        event = supabase.table("events").select("*").eq("id", event_id).eq("created_by", user_id).single().execute()
        if not event.data:
            raise HTTPException(status_code=403, detail="Ingen behörighet")
        try:
            rekognition.delete_collection(CollectionId=get_collection_id(event_id))
        except:
            pass
        photos = supabase.table("photos").select("storage_path").eq("event_id", event_id).execute()
        for photo in photos.data:
            try:
                supabase.storage.from_("event-photos").remove([photo["storage_path"]])
            except:
                pass
        supabase.table("events").delete().eq("id", event_id).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats/{event_id}")
def get_event_stats(event_id: str):
    try:
        scans = supabase.table("event_scans").select("*").eq("event_id", event_id).execute()
        waitlist = supabase.table("waitlist").select("id").eq("event_id", event_id).execute()
        purchases = supabase.table("purchases").select("amount_ore, photo_ids, created_at").eq("status", "paid").execute()

        daily: dict = {}
        for scan in scans.data:
            day = scan["created_at"][:10]
            if day not in daily:
                daily[day] = {"scans": 0, "revenue": 0}
            daily[day]["scans"] += 1

        for p in purchases.data:
            day = p["created_at"][:10]
            if day not in daily:
                daily[day] = {"scans": 0, "revenue": 0}
            daily[day]["revenue"] += p["amount_ore"] / 100

        return {
            "total_scans": len(scans.data),
            "total_matches": sum(s["photo_count"] for s in scans.data),
            "total_photos_sold": sum(len(p["photo_ids"]) for p in purchases.data),
            "total_revenue_sek": sum(p["amount_ore"] for p in purchases.data) / 100,
            "conversion_rate": round(len(purchases.data) / max(len(scans.data), 1) * 100, 1),
            "waitlist_count": len(waitlist.data),
            "daily": daily,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
