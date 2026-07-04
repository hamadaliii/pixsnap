"""
PixSnap Phase 1 — Emergency cost fix helpers.

Drop this file next to main.py (backend/app/optimizations.py) and import from it.
It provides:
  - multi-version image generation (thumb, preview, blur placeholder) as WebP
  - SHA256 hashing for dedupe
  - match-result caching (skip AWS on refresh / same selfie)
  - usage logging (estimated egress / AI / email)
  - a budget guard that reads global_settings and enforces soft/hard limits

Everything is defensive: if a column/table is missing it degrades gracefully
instead of crashing the request.
"""

import io
import os
import hashlib
import base64
from datetime import datetime, timezone
from typing import Optional

from PIL import Image, ImageDraw, ImageFont


# ── Config ──────────────────────────────────────────────────────────────────
THUMB_MAX      = 320    # px, longest edge
PREVIEW_MAX    = 1200   # px, longest edge
THUMB_QUALITY  = 60
PREVIEW_QUALITY = 72
BLUR_SIZE      = 16     # px, tiny LQIP


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_ip(ip: str, salt: str = "") -> str:
    salt = salt or os.environ.get("IP_HASH_SALT", "pixsnap-static-salt")
    return hashlib.sha256((ip + salt).encode()).hexdigest()


def _load_rgb(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    return img


def _resize_longest(img: Image.Image, longest: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= longest:
        return img.copy()
    if w >= h:
        nw = longest
        nh = int(h * (longest / w))
    else:
        nh = longest
        nw = int(w * (longest / h))
    return img.resize((nw, nh), Image.LANCZOS)


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _apply_watermark(img: Image.Image, text: str, opacity: int = 55) -> Image.Image:
    """Tiled diagonal watermark. Returns an RGB image."""
    base = img.convert("RGBA")
    w, h = base.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    font = _load_font(max(20, w // 12))

    tmp_draw = ImageDraw.Draw(layer)
    bbox = tmp_draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    step_x = tw + 40
    step_y = th + 60

    diag = int((w ** 2 + h ** 2) ** 0.5) + max(tw, th) * 2
    tile = Image.new("RGBA", (diag, diag), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    for y in range(0, diag, step_y):
        offset = (step_x // 2) if (y // step_y) % 2 else 0
        for x in range(-step_x, diag, step_x):
            td.text((x + offset, y), text, font=font, fill=(255, 255, 255, opacity))
    tile = tile.rotate(-30, expand=False)
    left = (tile.width - w) // 2
    top = (tile.height - h) // 2
    try:
        layer = Image.alpha_composite(layer, tile.crop((left, top, left + w, top + h)))
    except Exception:
        pass
    return Image.alpha_composite(base, layer).convert("RGB")


def build_versions(image_bytes: bytes, watermark_text: str = "PixSnap"):
    """
    Returns a dict with WebP bytes for thumb + preview, a tiny base64 blur
    placeholder, and metadata. All watermarked. Original stays untouched.
    """
    img = _load_rgb(image_bytes)
    orig_w, orig_h = img.size

    # Preview (lightbox)
    preview_img = _apply_watermark(_resize_longest(img, PREVIEW_MAX), watermark_text)
    preview_buf = io.BytesIO()
    preview_img.save(preview_buf, format="WEBP", quality=PREVIEW_QUALITY, method=4)
    preview_bytes = preview_buf.getvalue()

    # Thumb (grid)
    thumb_img = _apply_watermark(_resize_longest(img, THUMB_MAX), watermark_text)
    thumb_buf = io.BytesIO()
    thumb_img.save(thumb_buf, format="WEBP", quality=THUMB_QUALITY, method=4)
    thumb_bytes = thumb_buf.getvalue()

    # Blur placeholder (LQIP) — tiny WebP as base64 data URI
    blur_img = _resize_longest(img, BLUR_SIZE)
    blur_buf = io.BytesIO()
    blur_img.save(blur_buf, format="WEBP", quality=30, method=0)
    blur_b64 = "data:image/webp;base64," + base64.b64encode(blur_buf.getvalue()).decode()

    return {
        "preview_bytes": preview_bytes,
        "thumb_bytes": thumb_bytes,
        "blur_placeholder": blur_b64,
        "width": orig_w,
        "height": orig_h,
        "preview_size_bytes": len(preview_bytes),
        "thumb_size_bytes": len(thumb_bytes),
    }


# ── Usage logging + budget guard ────────────────────────────────────────────

def log_usage(supabase, kind: str, event_id: Optional[str] = None,
              bytes_est: int = 0, count: int = 1, meta: dict = None):
    """Best-effort usage accounting. Never raises."""
    try:
        supabase.table("usage_events").insert({
            "event_id": event_id,
            "kind": kind,
            "bytes": bytes_est,
            "count": count,
            "meta": meta or {},
        }).execute()
    except Exception as e:
        print(f"[usage] log fel ({kind}): {e}")


def _month_start_iso() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


def get_global_settings(supabase) -> dict:
    try:
        r = supabase.table("global_settings").select("*").eq("id", 1).single().execute()
        return r.data or {}
    except Exception:
        return {}


def budget_status(supabase) -> dict:
    """
    Returns a dict describing whether egress/AI/email are within soft/hard limits
    this billing month. Used to throttle before expensive operations.
    """
    settings = get_global_settings(supabase)
    if not settings:
        return {"ok": True, "scans_enabled": True, "downloads_enabled": True}

    since = _month_start_iso()
    egress = ai_search = emails = 0
    try:
        rows = supabase.table("usage_events").select("kind, bytes, count") \
            .gte("created_at", since).execute().data or []
        for row in rows:
            if row["kind"] == "egress" or row["kind"] == "zip":
                egress += row.get("bytes", 0) or 0
            elif row["kind"] == "ai_search":
                ai_search += row.get("count", 0) or 0
            elif row["kind"] == "email":
                emails += row.get("count", 0) or 0
    except Exception as e:
        print(f"[budget] status fel: {e}")

    soft = settings.get("monthly_egress_soft_limit", 4_000_000_000)
    hard = settings.get("monthly_egress_hard_limit", 4_800_000_000)

    egress_hard_hit = egress >= hard
    egress_soft_hit = egress >= soft
    ai_hit = ai_search >= settings.get("monthly_ai_search_limit", 4000)
    email_hit = emails >= settings.get("monthly_email_limit", 400)

    scans_enabled = settings.get("scans_enabled", True) and not egress_hard_hit and not ai_hit
    downloads_enabled = settings.get("downloads_enabled", True) and not egress_hard_hit

    return {
        "ok": not egress_hard_hit,
        "egress_bytes": egress,
        "ai_search": ai_search,
        "emails": emails,
        "egress_soft_hit": egress_soft_hit,
        "egress_hard_hit": egress_hard_hit,
        "ai_hit": ai_hit,
        "email_hit": email_hit,
        "scans_enabled": scans_enabled,
        "downloads_enabled": downloads_enabled,
        "maintenance_mode": settings.get("maintenance_mode", False),
    }


# ── Match cache ─────────────────────────────────────────────────────────────

def find_cached_match(supabase, event_id: str, selfie_hash: str) -> Optional[dict]:
    """Return a non-expired cached match for this event + selfie hash, if any."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        r = supabase.table("match_results").select("*") \
            .eq("event_id", event_id).eq("selfie_hash", selfie_hash) \
            .gt("expires_at", now).order("created_at", desc=True).limit(1).execute()
        if r.data:
            return r.data[0]
    except Exception as e:
        print(f"[cache] lookup fel: {e}")
    return None


def store_match(supabase, event_id: str, selfie_hash: str,
                photo_ids: list, guest_session_id: str = None, confidence_avg: float = None):
    try:
        supabase.table("match_results").insert({
            "event_id": event_id,
            "guest_session_id": guest_session_id,
            "selfie_hash": selfie_hash,
            "photo_ids": photo_ids,
            "confidence_avg": confidence_avg,
        }).execute()
    except Exception as e:
        print(f"[cache] store fel: {e}")


# ── Rate limiting (DB-backed, no Redis dependency) ──────────────────────────

def count_recent_attempts(supabase, *, event_id: str = None, ip_hash: str = None,
                          kind: str = None, minutes: int = 10) -> int:
    """Count scan_attempts in the last N minutes for rate limiting."""
    try:
        from datetime import timedelta
        since = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
        q = supabase.table("scan_attempts").select("id", count="exact").gte("created_at", since)
        if event_id:
            q = q.eq("event_id", event_id)
        if ip_hash:
            q = q.eq("ip_hash", ip_hash)
        if kind:
            q = q.eq("kind", kind)
        r = q.execute()
        return r.count or 0
    except Exception as e:
        print(f"[ratelimit] count fel: {e}")
        return 0


def log_attempt(supabase, *, event_id: str = None, ip_hash: str = None,
                session_token: str = None, kind: str = "match", success: bool = True):
    try:
        supabase.table("scan_attempts").insert({
            "event_id": event_id,
            "ip_hash": ip_hash,
            "session_token": session_token,
            "kind": kind,
            "success": success,
        }).execute()
    except Exception as e:
        print(f"[ratelimit] log fel: {e}")
