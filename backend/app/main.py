"""
PixSnap API v9 — Full featured
"""

import os, io, json, zipfile, math
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import boto3
import requests as req
import stripe
import resend
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
RESEND_API_KEY       = os.environ["RESEND_API_KEY"]
FRONTEND_URL         = os.environ.get("FRONTEND_URL", "http://localhost:3000")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
stripe.api_key = STRIPE_SECRET
resend.api_key = RESEND_API_KEY

rekognition = boto3.client(
    "rekognition",
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION,
)

app = FastAPI(title="PixSnap API v9")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
print("[startup] PixSnap API v9 klar!")


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
    try:
        resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": [email],
            "subject": f"📸 Dina foton från {event_name} är redo!",
            "html": f"""
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
            """,
        })
        print(f"[notify] Email skickat till {email}")
    except Exception as e:
        print(f"[notify] Email-fel: {e}")


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "PixSnap API v9"}


@app.post("/embed", response_model=EmbedResponse)
def embed_photo(data: EmbedRequest):
    try:
        ensure_collection(data.event_id)
        image_bytes = download_bytes(data.photo_url)

        response = rekognition.index_faces(
            CollectionId=get_collection_id(data.event_id),
            Image={"Bytes": image_bytes},
            ExternalImageId=data.photo_id,
            DetectionAttributes=[],
            MaxFaces=50,
            QualityFilter="AUTO",
        )
        faces_found = len(response.get("FaceRecords", []))

        watermark_text = data.watermark_text or "PixSnap"
        watermarked_bytes = create_watermarked_sd(image_bytes, watermark_text)
        wm_path = f"watermarks/{data.event_id}/{data.photo_id}.jpg"
        supabase.storage.from_("event-photos").upload(wm_path, watermarked_bytes, {"content-type": "image/jpeg", "upsert": "true"})
        wm_url = supabase.storage.from_("event-photos").get_public_url(wm_path)

        supabase.table("photos").update({"processed": True, "watermark_url": wm_url}).eq("id", data.photo_id).execute()

        print(f"[embed] {data.photo_id[:8]}... {faces_found} ansikten")
        return EmbedResponse(success=True, photo_id=data.photo_id, faces_found=faces_found)
    except Exception as e:
        print(f"[embed] Fel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/find", response_model=FindResponse)
def find_matches(data: FindRequest):
    try:
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

        # Kolla om foton är publicerade
        photos_ready = bool(event.get("published_at"))

        image_bytes = download_bytes(data.selfie_url)

        is_suspicious, reason = detect_screen_or_screenshot(image_bytes)
        if is_suspicious:
            return FindResponse(success=False, matches=[], message=f"Säkerhetsfel: {reason}")

        response = rekognition.search_faces_by_image(
            CollectionId=get_collection_id(data.event_id),
            Image={"Bytes": image_bytes},
            MaxFaces=500,
            FaceMatchThreshold=99.0,
        )

        matched_photo_ids = list({m["Face"]["ExternalImageId"] for m in response.get("FaceMatches", [])})

        supabase.table("event_scans").insert({"event_id": data.event_id, "photo_count": len(matched_photo_ids)}).execute()

        session_result = supabase.table("guest_sessions").insert({
            "event_id": data.event_id,
            "email": data.email or None,
            "photo_ids": matched_photo_ids,
        }).execute()

        session_token = session_result.data[0]["token"]

        supabase.table("consents").insert({
            "session_id": session_result.data[0]["id"],
            "event_id": data.event_id,
        }).execute()

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
    """Gäst registrerar sig för notis när foton är klara."""
    try:
        # Kolla om redan registrerad
        existing = supabase.table("waitlist").select("id") \
            .eq("event_id", data.event_id).eq("email", data.email).execute()
        if existing.data:
            return {"success": True, "message": "Du är redan registrerad"}

        supabase.table("waitlist").insert({
            "event_id": data.event_id,
            "email": data.email,
        }).execute()

        # Bekräftelse-email
        event = supabase.table("events").select("name").eq("id", data.event_id).single().execute()
        event_name = event.data["name"] if event.data else "eventet"

        background_tasks.add_task(
            resend.Emails.send, {
                "from": "onboarding@resend.dev",
                "to": [data.email],
                "subject": f"Vi meddelar dig när foton från {event_name} är klara",
                "html": f"""
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;">
                    <h2 style="font-size:22px;color:#111;">Vi hör av oss! 📸</h2>
                    <p style="color:#555;font-size:15px;line-height:1.6;">
                        Du är nu registrerad och får ett email med en direkt länk till dina foton
                        så fort fotografen publicerar bilderna från <strong>{event_name}</strong>.
                    </p>
                    <p style="color:#555;font-size:14px;line-height:1.6;">
                        Du behöver inte göra något mer — vi skickar länken direkt till dig.
                    </p>
                    <p style="color:#999;font-size:12px;margin-top:32px;">
                        <a href="{FRONTEND_URL}/privacy" style="color:#999;">Integritetspolicy</a>
                    </p>
                </div>
                """,
            }
        )

        return {"success": True, "message": f"Du får ett email när foton från {event_name} är klara"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/publish")
def publish_event(data: PublishRequest, background_tasks: BackgroundTasks):
    """Fotografen publicerar foton — skickar notifikationer till alla på väntelistan."""
    try:
        # Verifiera ägande
        event = supabase.table("events").select("*").eq("id", data.event_id).eq("created_by", data.user_id).single().execute()
        if not event.data:
            raise HTTPException(status_code=403, detail="Ingen behörighet")

        if event.data.get("notification_sent"):
            return {"success": True, "message": "Notifikationer redan skickade", "count": 0}

        # Markera som publicerat
        supabase.table("events").update({
            "published_at": datetime.now(timezone.utc).isoformat(),
            "notification_sent": True,
        }).eq("id", data.event_id).execute()

        # Hämta väntelistan
        waitlist = supabase.table("waitlist").select("*").eq("event_id", data.event_id).execute()
        event_name = event.data["name"]
        count = 0

        for entry in waitlist.data:
            if not entry.get("email"):
                continue

            # Matcha foton för denna person om selfie finns
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
                # Skapa session med matchade foton
                session_result = supabase.table("guest_sessions").insert({
                    "event_id": data.event_id,
                    "email": entry["email"],
                    "photo_ids": matched,
                }).execute()
                token = session_result.data[0]["token"]
                background_tasks.add_task(send_notification_email, entry["email"], event_name, token, len(matched))
            else:
                # Skicka email som ber dem skanna igen
                # Hämta event slug för länken
                event_slug_result = supabase.table("events").select("slug").eq("id", data.event_id).single().execute()
                event_slug = event_slug_result.data["slug"] if event_slug_result.data else ""
                selfie_url = f"{FRONTEND_URL}/event/{event_slug}"
                background_tasks.add_task(
                    resend.Emails.send, {
                        "from": "onboarding@resend.dev",
                        "to": [entry["email"]],
                        "subject": f"📸 Foton från {event_name} är nu klara!",
                        "html": f"""
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
                        """,
                    }
                )
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

        # Hämta event för prisinfo
        photo = supabase.table("photos").select("event_id").eq("id", data.photo_ids[0]).single().execute()
        event_id = photo.data["event_id"] if photo.data else None

        event = supabase.table("events").select("price_per_photo_ore, package_enabled, package_price_ore, name").eq("id", event_id).single().execute() if event_id else None

        price_per_photo = event.data.get("price_per_photo_ore", 1000) if event and event.data else 1000
        package_enabled = event.data.get("package_enabled", False) if event and event.data else False
        package_price = event.data.get("package_price_ore", 4900) if event and event.data else 4900
        event_name = event.data.get("name", "PixSnap") if event and event.data else "PixSnap"

        # Beräkna pris
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
    if event["type"] == "checkout.session.completed":
        purchase_id = event["data"]["object"].get("metadata", {}).get("purchase_id")
        if purchase_id:
            supabase.table("purchases").update({"status": "paid"}).eq("id", purchase_id).execute()
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


@app.get("/download-free")
def download_free(ids: str):
    try:
        photo_ids = [i for i in ids.split(",") if i]
        photos = supabase.table("photos").select("id, watermark_url, public_url").in_("id", photo_ids).execute()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, p in enumerate(photos.data):
                try:
                    url = p.get("watermark_url") or p["public_url"]
                    img_bytes = download_bytes(url)
                    if not p.get("watermark_url"):
                        img_bytes = create_watermarked_sd(img_bytes)
                    zf.writestr(f"pixsnap_foto_{i+1}_watermark.jpg", img_bytes)
                except Exception as e:
                    print(f"[zip-free] Fel: {e}")
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=pixsnap_foton_gratis.zip"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/session/{token}")
def get_session(token: str):
    try:
        result = supabase.table("guest_sessions").select("*").eq("token", token).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Session hittades inte")
        photos = supabase.table("photos").select("id, public_url, watermark_url").in_("id", result.data["photo_ids"]).execute()

        # Hämta event-info för prisvisning
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
def send_email(data: EmailRequest):
    try:
        result = supabase.table("guest_sessions").select("*").eq("token", data.session_token).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Session hittades inte")
        photo_count = len(result.data["photo_ids"])
        gallery_url = f"{FRONTEND_URL}/session/{data.session_token}"
        supabase.table("guest_sessions").update({"email": data.email}).eq("token", data.session_token).execute()

        event = supabase.table("events").select("name").eq("id", result.data["event_id"]).single().execute()
        event_name = event.data["name"] if event.data else "eventet"

        resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": [data.email],
            "subject": f"Dina {photo_count} foton från {event_name}",
            "html": f"""
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;">
                <h2 style="font-size:22px;color:#111;">Dina foton är redo 📸</h2>
                <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:32px;">
                    Vi hittade {photo_count} foto{'n' if photo_count > 1 else ''} på dig från <strong>{event_name}</strong>.
                </p>
                <a href="{gallery_url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Se dina foton →</a>
                <p style="color:#999;font-size:12px;margin-top:32px;">Länken gäller i 30 dagar. Din selfie raderas inom 24h.</p>
            </div>
            """,
        })
        return {"success": True}
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
@app.get("/download-free-original")
def download_free_original(ids: str):
    """Download original quality photos (used when payment is disabled)."""
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