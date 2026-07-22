import hashlib
import hmac
import os
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Optional

from fastapi import Request


DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "saveany.sqlite3"
SESSION_COOKIE = "saveany_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

_lock = threading.RLock()


def _connect():
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with _lock, _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              stripe_customer_id TEXT,
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS memberships (
              user_id INTEGER PRIMARY KEY,
              plan TEXT,
              status TEXT NOT NULL DEFAULT 'inactive',
              stripe_customer_id TEXT,
              stripe_subscription_id TEXT UNIQUE,
              current_period_end INTEGER,
              updated_at INTEGER NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS checkout_sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              plan TEXT NOT NULL,
              stripe_session_id TEXT UNIQUE,
              checkout_url TEXT,
              status TEXT NOT NULL,
              expires_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS stripe_events (
              event_id TEXT PRIMARY KEY,
              event_type TEXT NOT NULL,
              processed_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_usage (
              user_id INTEGER NOT NULL,
              usage_date TEXT NOT NULL,
              feature TEXT NOT NULL,
              count INTEGER NOT NULL DEFAULT 0,
              updated_at INTEGER NOT NULL,
              PRIMARY KEY (user_id, usage_date, feature),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ai_usage_resources (
              user_id INTEGER NOT NULL,
              usage_date TEXT NOT NULL,
              feature TEXT NOT NULL,
              resource_key TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              PRIMARY KEY (user_id, usage_date, feature, resource_key),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )


def _hash_password(password: str, salt: Optional[bytes] = None) -> str:
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 260000)
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = password_hash.split("$", 2)
        if scheme != "pbkdf2_sha256":
            return False
        expected = _hash_password(password, bytes.fromhex(salt_hex)).split("$", 2)[2]
        return hmac.compare_digest(expected, digest_hex)
    except Exception:
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_user(email: str, password: str):
    now = int(time.time())
    with _lock, _connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (normalize_email(email), _hash_password(password), now),
            )
            user_id = cur.lastrowid
            conn.execute(
                "INSERT INTO memberships (user_id, status, updated_at) VALUES (?, 'inactive', ?)",
                (user_id, now),
            )
            return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        except sqlite3.IntegrityError:
            return None


def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user or not _verify_password(password, user["password_hash"]):
        return None
    return user


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (_token_hash(token), user_id, now + SESSION_TTL_SECONDS, now),
        )
    return token


def delete_session(token: str):
    if not token:
        return
    with _lock, _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def get_user_by_email(email: str):
    with _lock, _connect() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (normalize_email(email),)
        ).fetchone()


def get_user_by_id(user_id: int):
    with _lock, _connect() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def get_user_from_token(token: str):
    if not token:
        return None
    now = int(time.time())
    with _lock, _connect() as conn:
        row = conn.execute(
            """
            SELECT u.* FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (_token_hash(token), now),
        ).fetchone()
        if row is None:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
        return row


def get_request_user(request: Request):
    return get_user_from_token(request.cookies.get(SESSION_COOKIE, ""))


def update_user_stripe_customer(user_id: int, customer_id: str):
    with _lock, _connect() as conn:
        conn.execute(
            "UPDATE users SET stripe_customer_id = ? WHERE id = ?",
            (customer_id, user_id),
        )


def find_user_by_stripe_customer(customer_id: str):
    with _lock, _connect() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE stripe_customer_id = ?", (customer_id,)
        ).fetchone()


def get_membership(user_id: int):
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT * FROM memberships WHERE user_id = ?", (user_id,)
        ).fetchone()
    now = int(time.time())
    is_active = bool(
        row
        and row["status"] in ("active", "trialing")
        and (row["current_period_end"] is None or row["current_period_end"] > now)
    )
    return {
        "plan": row["plan"] if row else None,
        "status": row["status"] if row else "inactive",
        "current_period_end": row["current_period_end"] if row else None,
        "stripe_subscription_id": row["stripe_subscription_id"] if row else None,
        "is_active": is_active,
    }


def _today_key() -> str:
    return time.strftime("%Y-%m-%d", time.localtime())


def get_ai_quota(user_id: int, feature: str = "summary", limit: int = 3):
    today = _today_key()
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT count FROM ai_usage WHERE user_id = ? AND usage_date = ? AND feature = ?",
            (user_id, today, feature),
        ).fetchone()

    used = row["count"] if row else 0
    return {
        "feature": feature,
        "date": today,
        "limit": limit,
        "used": used,
        "remaining": max(0, limit - used),
    }


def consume_ai_quota(
    user_id: int,
    feature: str = "summary",
    limit: int = 3,
    resource_key: Optional[str] = None,
) -> bool:
    return reserve_ai_quota(user_id, feature, limit, resource_key)["allowed"]


def reserve_ai_quota(
    user_id: int,
    feature: str = "summary",
    limit: int = 3,
    resource_key: Optional[str] = None,
):
    today = _today_key()
    now = int(time.time())
    normalized_resource = (resource_key or "").strip()[:500]

    with _lock, _connect() as conn:
        if normalized_resource:
            existing_resource = conn.execute(
                """
                SELECT 1 FROM ai_usage_resources
                WHERE user_id = ? AND usage_date = ? AND feature = ? AND resource_key = ?
                """,
                (user_id, today, feature, normalized_resource),
            ).fetchone()
            if existing_resource:
                return {"allowed": True, "charged": False, "resource_key": normalized_resource}

        row = conn.execute(
            "SELECT count FROM ai_usage WHERE user_id = ? AND usage_date = ? AND feature = ?",
            (user_id, today, feature),
        ).fetchone()
        used = row["count"] if row else 0
        if used >= limit:
            return {"allowed": False, "charged": False, "resource_key": normalized_resource}

        if normalized_resource:
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO ai_usage_resources (
                  user_id, usage_date, feature, resource_key, created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, today, feature, normalized_resource, now),
            )
            if cursor.rowcount == 0:
                return {"allowed": True, "charged": False, "resource_key": normalized_resource}

        conn.execute(
            """
            INSERT INTO ai_usage (user_id, usage_date, feature, count, updated_at)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT(user_id, usage_date, feature) DO UPDATE SET
              count = count + 1,
              updated_at = excluded.updated_at
            """,
            (user_id, today, feature, now),
        )

        return {"allowed": True, "charged": True, "resource_key": normalized_resource}


def refund_ai_quota(
    user_id: int,
    feature: str = "summary",
    resource_key: Optional[str] = None,
) -> bool:
    today = _today_key()
    now = int(time.time())
    normalized_resource = (resource_key or "").strip()[:500]
    if not normalized_resource:
        return False

    with _lock, _connect() as conn:
        cursor = conn.execute(
            """
            DELETE FROM ai_usage_resources
            WHERE user_id = ? AND usage_date = ? AND feature = ? AND resource_key = ?
            """,
            (user_id, today, feature, normalized_resource),
        )
        if cursor.rowcount == 0:
            return False

        conn.execute(
            """
            UPDATE ai_usage
            SET count = CASE WHEN count > 0 THEN count - 1 ELSE 0 END,
                updated_at = ?
            WHERE user_id = ? AND usage_date = ? AND feature = ?
            """,
            (now, user_id, today, feature),
        )
        conn.execute(
            """
            DELETE FROM ai_usage
            WHERE user_id = ? AND usage_date = ? AND feature = ? AND count <= 0
            """,
            (user_id, today, feature),
        )
        return True


def upsert_membership(
    user_id: int,
    plan: Optional[str],
    status: str,
    stripe_customer_id: Optional[str],
    stripe_subscription_id: Optional[str],
    current_period_end: Optional[int],
):
    now = int(time.time())
    with _lock, _connect() as conn:
        conn.execute(
            """
            INSERT INTO memberships (
              user_id, plan, status, stripe_customer_id, stripe_subscription_id,
              current_period_end, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              plan = excluded.plan,
              status = excluded.status,
              stripe_customer_id = excluded.stripe_customer_id,
              stripe_subscription_id = excluded.stripe_subscription_id,
              current_period_end = excluded.current_period_end,
              updated_at = excluded.updated_at
            """,
            (
                user_id,
                plan,
                status,
                stripe_customer_id,
                stripe_subscription_id,
                current_period_end,
                now,
            ),
        )
        if stripe_customer_id:
            conn.execute(
                "UPDATE users SET stripe_customer_id = ? WHERE id = ?",
                (stripe_customer_id, user_id),
            )


def find_user_by_subscription(subscription_id: str):
    with _lock, _connect() as conn:
        return conn.execute(
            """
            SELECT u.* FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.stripe_subscription_id = ?
            """,
            (subscription_id,),
        ).fetchone()


def has_processed_event(event_id: str) -> bool:
    with _lock, _connect() as conn:
        return (
            conn.execute(
                "SELECT 1 FROM stripe_events WHERE event_id = ?", (event_id,)
            ).fetchone()
            is not None
        )


def mark_event_processed(event_id: str, event_type: str):
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO stripe_events (event_id, event_type, processed_at) VALUES (?, ?, ?)",
            (event_id, event_type, int(time.time())),
        )


def find_pending_checkout(user_id: int, plan: str):
    with _lock, _connect() as conn:
        return conn.execute(
            """
            SELECT * FROM checkout_sessions
            WHERE user_id = ? AND plan = ? AND status = 'pending' AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (user_id, plan, int(time.time())),
        ).fetchone()


def save_checkout_session(user_id: int, plan: str, session_id: str, url: str, expires_at: int):
    with _lock, _connect() as conn:
        conn.execute(
            """
            INSERT INTO checkout_sessions (
              user_id, plan, stripe_session_id, checkout_url, status, expires_at, created_at
            )
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
            """,
            (user_id, plan, session_id, url, expires_at, int(time.time())),
        )


def mark_checkout_paid(session_id: str):
    with _lock, _connect() as conn:
        conn.execute(
            "UPDATE checkout_sessions SET status = 'paid' WHERE stripe_session_id = ?",
            (session_id,),
        )


def get_checkout_session(session_id: str):
    with _lock, _connect() as conn:
        return conn.execute(
            "SELECT * FROM checkout_sessions WHERE stripe_session_id = ?",
            (session_id,),
        ).fetchone()


def mark_checkout_paid_if_needed(session_id: str) -> bool:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT status FROM checkout_sessions WHERE stripe_session_id = ?",
            (session_id,),
        ).fetchone()
        if row and row["status"] == "paid":
            return False

        conn.execute(
            "UPDATE checkout_sessions SET status = 'paid' WHERE stripe_session_id = ?",
            (session_id,),
        )
        return True


def public_user(user):
    if not user:
        return None
    membership = get_membership(user["id"])
    return {
        "id": user["id"],
        "email": user["email"],
        "membership": membership,
        "ai_quota": {
            "summary": get_ai_quota(user["id"]),
        },
    }
