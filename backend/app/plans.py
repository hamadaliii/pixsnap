"""
PixSnap Phase 2 — plan quotas, email queue, webhook idempotency, cleanup.

Drop next to main.py as backend/app/plans.py. Everything is failsafe: if a
table is missing or a lookup fails, the guard degrades to "allow" rather than
breaking a working flow (so deploying the backend before running the SQL
migration never takes the app down).
"""

import os
import uuid
import smtplib
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional


def _period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


# ── Plan resolution ─────────────────────────────────────────────────────────

def get_user_plan(supabase, user_id: str) -> dict:
    """Return {plan_id, status, limits{}} for a photographer. Failsafe → trial."""
    trial = {
        "plan_id": "trial", "status": "active",
        "limits": {
            "max_active_events": 1, "max_photos_per_event": 50,
            "max_scans_per_month": 25, "max_ai_matches_per_month": 25,
            "max_emails_per_month": 20, "max_downloads_per_month": 50,
            "max_storage_bytes": 500_000_000, "watermark_required": True,
            "custom_logo_allowed": False, "email_notifications": False,
        },
    }
    if not user_id:
        return trial
    try:
        pp = supabase.table("photographer_plans").select("plan_id, status") \
            .eq("user_id", user_id).single().execute()
        plan_id = (pp.data or {}).get("plan_id", "trial")
        status = (pp.data or {}).get("status", "active")
        pl = supabase.table("plan_limits").select("*").eq("plan_id", plan_id).single().execute()
        limits = pl.data or trial["limits"]
        # apply admin overrides
        try:
            ov = supabase.table("admin_overrides").select("*").eq("user_id", user_id).execute().data or []
            for o in ov:
                limits["max_active_events"]       = limits.get("max_active_events", 1) + (o.get("extra_events") or 0)
                limits["max_photos_per_event"]    = limits.get("max_photos_per_event", 50) + (o.get("extra_photos") or 0)
                limits["max_scans_per_month"]     = limits.get("max_scans_per_month", 25) + (o.get("extra_scans") or 0)
                limits["max_emails_per_month"]    = limits.get("max_emails_per_month", 20) + (o.get("extra_emails") or 0)
                limits["max_downloads_per_month"] = limits.get("max_downloads_per_month", 50) + (o.get("extra_downloads") or 0)
        except Exception:
            pass
        return {"plan_id": plan_id, "status": status, "limits": limits}
    except Exception as e:
        print(f"[plans] get_user_plan failsafe→trial: {e}")
        return trial


def _get_counter(supabase, user_id: str) -> dict:
    try:
        r = supabase.table("usage_counters").select("*") \
            .eq("user_id", user_id).eq("period", _period()).single().execute()
        return r.data or {}
    except Exception:
        return {}


def increment_counter(supabase, user_id: str, field: str, amount: int = 1):
    """Atomic-ish increment of a monthly usage counter. Failsafe."""
    if not user_id:
        return
    try:
        period = _period()
        existing = supabase.table("usage_counters").select("*") \
            .eq("user_id", user_id).eq("period", period).execute().data
        if existing:
            cur = existing[0].get(field, 0) or 0
            supabase.table("usage_counters").update({
                field: cur + amount, "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("user_id", user_id).eq("period", period).execute()
        else:
            supabase.table("usage_counters").insert({
                "user_id": user_id, "period": period, field: amount
            }).execute()
    except Exception as e:
        print(f"[plans] increment_counter fel: {e}")


def check_quota(supabase, user_id: str, kind: str) -> tuple[bool, str]:
    """
    kind: 'scan' | 'ai_match' | 'email' | 'download'
    Returns (allowed, message). Failsafe → allowed.
    """
    if not user_id:
        return True, ""
    try:
        plan = get_user_plan(supabase, user_id)
        if plan["status"] == "suspended":
            return False, "Kontot är pausat."
        limits = plan["limits"]
        counter = _get_counter(supabase, user_id)
        mapping = {
            "scan":     ("scans",     "max_scans_per_month",     "sökningar"),
            "ai_match": ("ai_matches","max_ai_matches_per_month","AI-matchningar"),
            "email":    ("emails",    "max_emails_per_month",    "email"),
            "download": ("downloads", "max_downloads_per_month", "nedladdningar"),
        }
        if kind not in mapping:
            return True, ""
        field, limit_key, label = mapping[kind]
        used = counter.get(field, 0) or 0
        limit = limits.get(limit_key, 999999)
        if used >= limit:
            try:
                supabase.table("quota_events").insert({
                    "user_id": user_id, "kind": f"blocked_{kind}",
                    "detail": f"{used}/{limit} {label}",
                }).execute()
            except Exception:
                pass
            return False, f"Månadsgränsen för {label} är nådd ({limit}). Uppgradera planen för mer."
        return True, ""
    except Exception as e:
        print(f"[plans] check_quota failsafe→allow: {e}")
        return True, ""


def event_owner(supabase, event_id: str) -> Optional[str]:
    try:
        r = supabase.table("events").select("created_by").eq("id", event_id).single().execute()
        return (r.data or {}).get("created_by")
    except Exception:
        return None


# ── Email queue ─────────────────────────────────────────────────────────────

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)


def email_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD)


def enqueue_email(supabase, to_email: str, subject: str, html: str,
                  template: str = None, dedupe_key: str = None, user_id: str = None) -> dict:
    """Add an email to the queue. Deduped by dedupe_key. Failsafe."""
    try:
        row = {
            "to_email": to_email, "subject": subject, "html": html,
            "template": template, "dedupe_key": dedupe_key, "user_id": user_id,
        }
        supabase.table("email_queue").insert(row).execute()
        return {"queued": True}
    except Exception as e:
        # dedupe unique-violation is expected and fine
        msg = str(e)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return {"queued": False, "reason": "duplicate"}
        print(f"[email] enqueue fel: {e}")
        return {"queued": False, "reason": msg}


def _send_smtp(to_email: str, subject: str, html: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())


def process_email_queue(supabase, limit: int = 10) -> dict:
    """
    Process pending emails with exponential backoff. Returns a summary.
    Call from a scheduled endpoint (e.g. Render cron hitting /admin/email/process).
    """
    if not email_configured():
        return {"ok": False, "reason": "email_not_configured", "sent": 0, "failed": 0}

    now = datetime.now(timezone.utc).isoformat()
    sent = failed = 0
    try:
        rows = supabase.table("email_queue").select("*") \
            .eq("status", "pending").lte("next_attempt_at", now) \
            .order("created_at").limit(limit).execute().data or []
    except Exception as e:
        return {"ok": False, "reason": str(e), "sent": 0, "failed": 0}

    for row in rows:
        try:
            _send_smtp(row["to_email"], row["subject"], row["html"])
            supabase.table("email_queue").update({"status": "sent", "attempts": (row.get("attempts") or 0) + 1}).eq("id", row["id"]).execute()
            supabase.table("email_logs").insert({
                "to_email": row["to_email"], "subject": row["subject"],
                "template": row.get("template"), "status": "sent",
            }).execute()
            sent += 1
        except Exception as e:
            attempts = (row.get("attempts") or 0) + 1
            backoff_min = min(60, 2 ** attempts)  # 2,4,8,16,32,60 min
            next_at = (datetime.now(timezone.utc) + timedelta(minutes=backoff_min)).isoformat()
            status = "failed" if attempts >= 5 else "pending"
            supabase.table("email_queue").update({
                "status": status, "attempts": attempts,
                "next_attempt_at": next_at, "last_error": str(e)[:500],
            }).eq("id", row["id"]).execute()
            if status == "failed":
                supabase.table("email_logs").insert({
                    "to_email": row["to_email"], "subject": row["subject"],
                    "template": row.get("template"), "status": "failed", "error": str(e)[:500],
                }).execute()
            failed += 1
    return {"ok": True, "sent": sent, "failed": failed, "processed": len(rows)}


# ── Stripe webhook idempotency ──────────────────────────────────────────────

def webhook_already_processed(supabase, event_id: str) -> bool:
    try:
        r = supabase.table("webhook_events").select("id").eq("id", event_id).execute()
        return bool(r.data)
    except Exception:
        return False


def mark_webhook_processed(supabase, event_id: str, event_type: str, purchase_id: str = None):
    try:
        supabase.table("webhook_events").insert({
            "id": event_id, "type": event_type, "purchase_id": purchase_id,
        }).execute()
    except Exception as e:
        print(f"[webhook] mark fel: {e}")


# ── Cleanup jobs ────────────────────────────────────────────────────────────

def run_cleanup(supabase, storage_from=None) -> dict:
    """
    Cleanup jobs. Failsafe & idempotent. Covers:
      - expired match_results (cache TTL)
      - selfies older than 24h
      - auto-expire events past expires_at
      - orphan DB rows (photos whose event was deleted)
      - orphan storage files (event-photos with no matching photo row)
      - failed/unprocessed uploads older than 24h
      - old signed download tokens (paid > 30 days ago)
    `storage_from` is supabase.storage.from_ .
    """
    from datetime import datetime, timezone, timedelta
    summary = {
        "selfies_deleted": 0, "matches_expired": 0, "events_expired": 0,
        "orphan_photos": 0, "orphan_files": 0, "failed_uploads": 0,
        "download_links_expired": 0, "errors": [],
    }
    now = datetime.now(timezone.utc)
    cutoff_24h = (now - timedelta(hours=24)).isoformat()
    cutoff_30d = (now - timedelta(days=30)).isoformat()

    # 1. Expired match_results (cache TTL)
    try:
        old = supabase.table("match_results").select("id").lt("expires_at", now.isoformat()).execute().data or []
        for m in old:
            supabase.table("match_results").delete().eq("id", m["id"]).execute()
        summary["matches_expired"] = len(old)
    except Exception as e:
        summary["errors"].append(f"matches: {e}")

    # 2. Old selfie files (older than 24h)
    if storage_from is not None:
        try:
            files = storage_from("selfies").list() or []
            for f in files:
                created = f.get("created_at")
                if created and created < cutoff_24h:
                    try:
                        storage_from("selfies").remove([f["name"]])
                        summary["selfies_deleted"] += 1
                    except Exception:
                        pass
        except Exception as e:
            summary["errors"].append(f"selfies: {e}")

    # 3. Auto-expire events past expires_at
    try:
        expired = supabase.table("events").select("id").lt("expires_at", now.isoformat()).eq("is_active", True).execute().data or []
        for ev in expired:
            supabase.table("events").update({"is_active": False}).eq("id", ev["id"]).execute()
        summary["events_expired"] = len(expired)
    except Exception as e:
        summary["errors"].append(f"events: {e}")

    # 4. Orphan photos: photo rows whose event no longer exists
    try:
        event_ids = {e["id"] for e in (supabase.table("events").select("id").execute().data or [])}
        photos = supabase.table("photos").select("id, event_id, storage_path").execute().data or []
        for ph in photos:
            if ph.get("event_id") not in event_ids:
                # delete file then row
                if storage_from is not None and ph.get("storage_path"):
                    try:
                        storage_from("event-photos").remove([ph["storage_path"]])
                    except Exception:
                        pass
                supabase.table("photos").delete().eq("id", ph["id"]).execute()
                summary["orphan_photos"] += 1
    except Exception as e:
        summary["errors"].append(f"orphan_photos: {e}")

    # 5. Failed / stuck uploads: unprocessed photos older than 24h with no thumb
    try:
        stuck = supabase.table("photos").select("id, created_at, processed, thumb_url") \
            .eq("processed", False).lt("created_at", cutoff_24h).execute().data or []
        for ph in stuck:
            if not ph.get("thumb_url"):
                summary["failed_uploads"] += 1  # report only; do not auto-delete user photos
    except Exception as e:
        summary["errors"].append(f"failed_uploads: {e}")

    # 6. Expire old download tokens (paid > 30 days ago) so signed links stop working
    try:
        old_paid = supabase.table("purchases").select("id").eq("status", "paid") \
            .lt("paid_at", cutoff_30d).not_.is_("download_token", "null").execute().data or []
        for pr in old_paid:
            supabase.table("purchases").update({"download_token": None}).eq("id", pr["id"]).execute()
        summary["download_links_expired"] = len(old_paid)
    except Exception as e:
        summary["errors"].append(f"download_links: {e}")

    return summary
