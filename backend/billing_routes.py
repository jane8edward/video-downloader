import os
import time
from typing import Optional

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_store import (
    find_pending_checkout,
    get_checkout_session,
    get_membership,
    get_request_user,
    has_processed_event,
    mark_checkout_paid_if_needed,
    mark_event_processed,
    public_user,
    save_checkout_session,
    update_user_stripe_customer,
    upsert_membership,
)


router = APIRouter(prefix="/api/billing", tags=["Billing"])

load_dotenv()

PLAN_CONFIG = {
    "monthly": {
        "name": "月度会员",
        "price_env": "STRIPE_PRICE_MONTHLY",
        "amount": 990,
        "currency": "cny",
        "duration_days": 30,
    },
    "yearly": {
        "name": "年度会员",
        "price_env": "STRIPE_PRICE_YEARLY",
        "amount": 6800,
        "currency": "cny",
        "duration_days": 365,
    },
}


class CheckoutRequest(BaseModel):
    plan: str


class SyncCheckoutRequest(BaseModel):
    session_id: Optional[str] = None


def _stripe_configured() -> bool:
    return bool(os.getenv("STRIPE_SECRET_KEY"))


def _frontend_base_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _get_price_id(plan: str) -> str:
    config = PLAN_CONFIG.get(plan)
    if not config:
        raise HTTPException(status_code=400, detail="未知会员套餐")

    price_id = os.getenv(config["price_env"])
    if not price_id:
        raise HTTPException(
            status_code=500,
            detail=f"缺少环境变量 {config['price_env']}，请先在 Stripe 后台创建一次性价格并配置 Price ID",
        )
    return price_id


def _calculate_period_end(user_id: int, plan: str) -> int:
    now = int(time.time())
    membership = get_membership(user_id)
    starts_at = max(now, membership.get("current_period_end") or 0)
    return starts_at + PLAN_CONFIG[plan]["duration_days"] * 24 * 60 * 60


def _metadata_get(obj, key: str, default=None):
    metadata = getattr(obj, "metadata", None)
    if not metadata:
        return default
    if hasattr(metadata, "get"):
        return metadata.get(key, default)
    try:
        return metadata[key]
    except Exception:
        return getattr(metadata, key, default)


def _activate_membership_from_session(session) -> bool:
    plan = _metadata_get(session, "plan")
    if plan not in PLAN_CONFIG:
        return False

    user_id = int(session.client_reference_id or _metadata_get(session, "user_id"))
    if not mark_checkout_paid_if_needed(session.id):
        return False

    upsert_membership(
        user_id=user_id,
        plan=plan,
        status="active",
        stripe_customer_id=session.customer,
        stripe_subscription_id=None,
        current_period_end=_calculate_period_end(user_id, plan),
    )
    return True


async def _get_or_create_customer(user):
    if user["stripe_customer_id"]:
        return user["stripe_customer_id"]

    customer = stripe.Customer.create(
        email=user["email"],
        metadata={"user_id": str(user["id"])},
        idempotency_key=f"saveany-customer-{user['id']}",
    )
    update_user_stripe_customer(user["id"], customer.id)
    return customer.id


@router.get("/plans")
async def plans():
    return {
        "plans": [
            {
                "id": key,
                "name": value["name"],
                "amount": value["amount"],
                "currency": value["currency"],
                "duration_days": value["duration_days"],
            }
            for key, value in PLAN_CONFIG.items()
        ]
    }


@router.post("/checkout")
async def create_checkout_session(req: CheckoutRequest, request: Request):
    if not _stripe_configured():
        raise HTTPException(status_code=500, detail="缺少 STRIPE_SECRET_KEY，暂时无法创建支付")

    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="请先注册或登录，再开通会员")

    price_id = _get_price_id(req.plan)
    pending = find_pending_checkout(user["id"], req.plan)
    if pending:
        return {"url": pending["checkout_url"], "session_id": pending["stripe_session_id"]}

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    try:
        customer_id = await _get_or_create_customer(user)
        base_url = _frontend_base_url()

        session = stripe.checkout.Session.create(
            mode="payment",
            customer=customer_id,
            client_reference_id=str(user["id"]),
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{base_url}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/?checkout=cancel",
            metadata={"user_id": str(user["id"]), "plan": req.plan},
            idempotency_key=f"saveany-checkout-{user['id']}-{req.plan}-{int(time.time() // 600)}",
        )
    except stripe.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"无法连接 Stripe 或支付配置无效：{exc.user_message or str(exc)}")

    save_checkout_session(
        user["id"],
        req.plan,
        session.id,
        session.url,
        session.expires_at,
    )
    return {"url": session.url, "session_id": session.id}


@router.post("/sync-checkout")
async def sync_checkout_session(req: SyncCheckoutRequest, request: Request):
    if not _stripe_configured():
        raise HTTPException(status_code=500, detail="缺少 STRIPE_SECRET_KEY，暂时无法同步支付状态")

    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录")

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    session_ids = []

    if req.session_id:
        session_ids.append(req.session_id)
    else:
        pending = find_pending_checkout(user["id"], "monthly")
        if pending:
            session_ids.append(pending["stripe_session_id"])
        pending = find_pending_checkout(user["id"], "yearly")
        if pending:
            session_ids.append(pending["stripe_session_id"])

    synced = 0
    for session_id in dict.fromkeys(session_ids):
        local_session = get_checkout_session(session_id)
        if not local_session or local_session["user_id"] != user["id"]:
            continue
        if local_session["status"] == "paid":
            continue

        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except stripe.StripeError as exc:
            raise HTTPException(status_code=502, detail=f"无法同步 Stripe 支付状态：{exc.user_message or str(exc)}")

        if str(session.client_reference_id) != str(user["id"]):
            continue
        if session.status == "complete" and session.payment_status == "paid":
            if _activate_membership_from_session(session):
                synced += 1

    return {"synced": synced, "user": public_user(user)}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    if not _stripe_configured():
        raise HTTPException(status_code=500, detail="缺少 STRIPE_SECRET_KEY")

    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="缺少 STRIPE_WEBHOOK_SECRET")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Stripe Webhook payload 无效")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Stripe Webhook 签名校验失败")

    if has_processed_event(event.id):
        return {"received": True, "duplicate": True}

    if event.type == "checkout.session.completed":
        _handle_checkout_completed(event.data.object)

    mark_event_processed(event.id, event.type)
    return {"received": True}


def _handle_checkout_completed(session):
    _activate_membership_from_session(session)
