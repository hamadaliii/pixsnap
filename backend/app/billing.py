"""
PixSnap billing — subscription upgrades, event packs, coupons, Stripe portal.

Failsafe: if Stripe env is missing, every function returns a clear
"stripe_not_configured" signal instead of crashing. The webhook remains the
single source of truth for granting access (payment success page never is).
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import stripe

STRIPE_SECRET = os.environ.get("STRIPE_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

stripe_configured = bool(STRIPE_SECRET)
if stripe_configured:
    stripe.api_key = STRIPE_SECRET


def is_configured() -> bool:
    return stripe_configured


# ── Coupon validation ───────────────────────────────────────────────────────
def validate_coupon(supabase, code: str, plan_id: str = None, pack_id: str = None) -> dict:
    """Check a coupon code against the DB. Returns {valid, discount, ...}."""
    if not code:
        return {"valid": False, "message": "Ingen kod angiven"}
    try:
        r = supabase.table("coupon_codes").select("*").eq("code", code.upper()).eq("status", "active").execute()
        if not r.data:
            return {"valid": False, "message": "Ogiltig kod"}
        c = r.data[0]
        now = datetime.now(timezone.utc)
        if c.get("valid_until") and now > datetime.fromisoformat(c["valid_until"].replace("Z", "+00:00")):
            return {"valid": False, "message": "Koden har gått ut"}
        if c.get("max_redemptions") and (c.get("redemption_count") or 0) >= c["max_redemptions"]:
            return {"valid": False, "message": "Koden är slut"}
        if c.get("applies_to_plan_id") and plan_id and c["applies_to_plan_id"] != plan_id:
            return {"valid": False, "message": "Koden gäller inte denna plan"}
        if c.get("applies_to_event_pack_id") and pack_id and c["applies_to_event_pack_id"] != pack_id:
            return {"valid": False, "message": "Koden gäller inte detta paket"}
        return {
            "valid": True,
            "discount_percent": c.get("discount_percent"),
            "discount_amount": c.get("discount_amount"),
            "stripe_coupon_id": c.get("stripe_coupon_id"),
            "stripe_promotion_code_id": c.get("stripe_promotion_code_id"),
            "code": c["code"],
        }
    except Exception as e:
        print(f"[billing] coupon fel: {e}")
        return {"valid": False, "message": "Kunde inte validera koden"}


# ── Subscription checkout (plan upgrade) ────────────────────────────────────
def create_subscription_checkout(supabase, user_id: str, plan_id: str,
                                 email: str = None, coupon: str = None) -> dict:
    if not stripe_configured:
        return {"ok": False, "error": "stripe_not_configured"}
    try:
        plan = supabase.table("plans").select("*").eq("id", plan_id).single().execute().data
        if not plan:
            return {"ok": False, "error": "plan_not_found"}
        price_id = plan.get("stripe_monthly_price_id")
        if not price_id:
            return {"ok": False, "error": "plan_missing_stripe_price",
                    "message": f"Planen '{plan_id}' saknar Stripe-pris. Sätt stripe_monthly_price_id i admin."}

        params = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{FRONTEND_URL}/dashboard/billing/success?plan={plan_id}",
            "cancel_url": f"{FRONTEND_URL}/dashboard/billing/cancel",
            "client_reference_id": user_id,
            "metadata": {"user_id": user_id, "plan_id": plan_id, "type": "subscription"},
        }
        if email:
            params["customer_email"] = email

        # apply coupon if valid
        if coupon:
            cv = validate_coupon(supabase, coupon, plan_id=plan_id)
            if cv.get("valid"):
                if cv.get("stripe_promotion_code_id"):
                    params["discounts"] = [{"promotion_code": cv["stripe_promotion_code_id"]}]
                elif cv.get("stripe_coupon_id"):
                    params["discounts"] = [{"coupon": cv["stripe_coupon_id"]}]

        session = stripe.checkout.Session.create(**params)
        return {"ok": True, "checkout_url": session.url}
    except Exception as e:
        print(f"[billing] subscription checkout fel: {e}")
        return {"ok": False, "error": "stripe_error", "message": str(e)}


# ── Event pack checkout (one-time) ──────────────────────────────────────────
def create_event_pack_checkout(supabase, user_id: str, pack_id: str,
                               event_id: str = None, email: str = None, coupon: str = None) -> dict:
    if not stripe_configured:
        return {"ok": False, "error": "stripe_not_configured"}
    try:
        pack = supabase.table("event_packs").select("*").eq("id", pack_id).single().execute().data
        if not pack:
            return {"ok": False, "error": "pack_not_found"}

        params = {
            "mode": "payment",
            "success_url": f"{FRONTEND_URL}/dashboard/billing/success?pack={pack_id}",
            "cancel_url": f"{FRONTEND_URL}/dashboard/billing/cancel",
            "client_reference_id": user_id,
            "metadata": {"user_id": user_id, "pack_id": pack_id, "event_id": event_id or "", "type": "event_pack"},
        }
        if pack.get("stripe_price_id"):
            params["line_items"] = [{"price": pack["stripe_price_id"], "quantity": 1}]
        else:
            # inline price fallback
            params["line_items"] = [{
                "price_data": {
                    "currency": pack.get("currency", "sek"),
                    "product_data": {"name": pack["name"], "description": pack.get("description", "")},
                    "unit_amount": pack.get("price_amount", 0),
                },
                "quantity": 1,
            }]
        if email:
            params["customer_email"] = email
        if coupon:
            cv = validate_coupon(supabase, coupon, pack_id=pack_id)
            if cv.get("valid") and cv.get("stripe_promotion_code_id"):
                params["discounts"] = [{"promotion_code": cv["stripe_promotion_code_id"]}]

        session = stripe.checkout.Session.create(**params)
        return {"ok": True, "checkout_url": session.url}
    except Exception as e:
        print(f"[billing] event pack checkout fel: {e}")
        return {"ok": False, "error": "stripe_error", "message": str(e)}


# ── Customer portal ─────────────────────────────────────────────────────────
def create_portal(supabase, user_id: str) -> dict:
    if not stripe_configured:
        return {"ok": False, "error": "stripe_not_configured"}
    try:
        pp = supabase.table("photographer_plans").select("stripe_customer_id").eq("user_id", user_id).single().execute().data
        cust = (pp or {}).get("stripe_customer_id")
        if not cust:
            return {"ok": False, "error": "no_customer", "message": "Ingen aktiv prenumeration än"}
        session = stripe.billing_portal.Session.create(
            customer=cust, return_url=f"{FRONTEND_URL}/dashboard/billing")
        return {"ok": True, "portal_url": session.url}
    except Exception as e:
        return {"ok": False, "error": "stripe_error", "message": str(e)}


# ── Current billing state + usage ───────────────────────────────────────────
def get_current_billing(supabase, user_id: str, get_user_plan_fn, get_scan_credits_fn) -> dict:
    plan = get_user_plan_fn(supabase, user_id)
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    counter = {}
    try:
        c = supabase.table("usage_counters").select("*").eq("user_id", user_id).eq("period", period).execute().data
        counter = c[0] if c else {}
    except Exception:
        pass

    # subscription meta
    sub = {}
    try:
        pp = supabase.table("photographer_plans").select("*").eq("user_id", user_id).single().execute().data
        sub = pp or {}
    except Exception:
        pass

    # active event packs
    packs = []
    try:
        now = datetime.now(timezone.utc).isoformat()
        packs = supabase.table("purchased_event_packs").select("*, event_packs(name)") \
            .eq("photographer_id", user_id).eq("status", "active").gt("expires_at", now).execute().data or []
    except Exception:
        pass

    # active event count
    active_events = 0
    try:
        r = supabase.table("events").select("id", count="exact", head=True).eq("created_by", user_id).eq("is_active", True).execute()
        active_events = r.count or 0
    except Exception:
        pass

    limits = plan["limits"]
    return {
        "plan_id": plan["plan_id"],
        "status": sub.get("status", "active"),
        "current_period_end": sub.get("current_period_end"),
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
        "scan_credits": get_scan_credits_fn(supabase, user_id),
        "usage": {
            "active_events": {"used": active_events, "limit": limits.get("max_active_events")},
            "scans":     {"used": counter.get("scans", 0),      "limit": limits.get("max_scans_per_month")},
            "ai_matches":{"used": counter.get("ai_matches", 0), "limit": limits.get("max_ai_matches_per_month")},
            "emails":    {"used": counter.get("emails", 0),     "limit": limits.get("max_emails_per_month")},
            "downloads": {"used": counter.get("downloads", 0),  "limit": limits.get("max_downloads_per_month")},
        },
        "storage_limit_bytes": limits.get("max_storage_bytes"),
        "active_packs": packs,
        "stripe_configured": stripe_configured,
    }


# ── Webhook handlers (called from the main /webhook with idempotency) ────────
def apply_subscription_completed(supabase, session_obj: dict):
    """checkout.session.completed for a subscription → upgrade the plan."""
    meta = session_obj.get("metadata", {})
    user_id = meta.get("user_id") or session_obj.get("client_reference_id")
    plan_id = meta.get("plan_id")
    if not user_id or not plan_id:
        return
    update = {
        "plan_id": plan_id,
        "status": "active",
        "stripe_customer_id": session_obj.get("customer"),
        "stripe_subscription_id": session_obj.get("subscription"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = supabase.table("photographer_plans").select("user_id").eq("user_id", user_id).execute().data
    if existing:
        supabase.table("photographer_plans").update(update).eq("user_id", user_id).execute()
    else:
        supabase.table("photographer_plans").insert({"user_id": user_id, **update}).execute()

    supabase.table("payment_logs").insert({
        "photographer_id": user_id, "type": "subscription",
        "stripe_checkout_session_id": session_obj.get("id"),
        "stripe_customer_id": session_obj.get("customer"),
        "stripe_subscription_id": session_obj.get("subscription"),
        "amount": session_obj.get("amount_total"), "status": "paid",
        "metadata": {"plan_id": plan_id},
    }).execute()


def apply_event_pack_completed(supabase, session_obj: dict, adjust_credits_fn):
    """checkout.session.completed for an event pack → grant quota + credits."""
    meta = session_obj.get("metadata", {})
    user_id = meta.get("user_id") or session_obj.get("client_reference_id")
    pack_id = meta.get("pack_id")
    event_id = meta.get("event_id") or None
    if not user_id or not pack_id:
        return
    pack = supabase.table("event_packs").select("*").eq("id", pack_id).single().execute().data
    if not pack:
        return
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=pack.get("validity_days", 30))
    supabase.table("purchased_event_packs").insert({
        "photographer_id": user_id, "event_id": event_id, "event_pack_id": pack_id,
        "stripe_checkout_session_id": session_obj.get("id"),
        "status": "active", "starts_at": now.isoformat(), "expires_at": expires.isoformat(),
    }).execute()

    # grant scan credits immediately
    if pack.get("extra_scans"):
        adjust_credits_fn(supabase, user_id, pack["extra_scans"], "event_pack", event_id=event_id)

    supabase.table("payment_logs").insert({
        "photographer_id": user_id, "event_id": event_id, "type": "event_pack",
        "stripe_checkout_session_id": session_obj.get("id"),
        "amount": session_obj.get("amount_total"), "status": "paid",
        "metadata": {"pack_id": pack_id},
    }).execute()
