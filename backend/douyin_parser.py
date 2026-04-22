"""
Dedicated Douyin video parser & downloader - NO cookies required.

Based on rathodpratham-dev/douyin_video_downloader (MIT License, Feb 2026).

Strategy:
1. Resolve share short link (v.douyin.com) → 302 redirect → real URL
2. Extract video_id from URL
3. Call iesdouyin.com public API to get video metadata
4. Replace "playwm" → "play" in the URL to get no-watermark video
5. Fallback: parse share page window._ROUTER_DATA if API fails
"""
import base64
import json
import logging
import re
from hashlib import sha256
from urllib.parse import parse_qs, urlparse

import httpx

logger = logging.getLogger("douyin_parser")

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/json,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Referer": "https://www.douyin.com/",
}

MOBILE_SHARE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
        "Mobile/15E148 Safari/604.1"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.douyin.com/",
}

DOUYIN_API_URL = "https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/"


# ─── URL helpers ──────────────────────────────────────────────

def is_douyin_url(url: str) -> bool:
    """Check if a URL is a Douyin link."""
    return any(p in url.lower() for p in ("douyin.com", "iesdouyin.com"))


def _extract_first_url(text: str) -> str:
    """Extract first URL from user input (may contain share text)."""
    match = re.search(r"https?://[^\s]+", text, re.IGNORECASE)
    if not match:
        raise ValueError("输入中未找到有效的URL")
    candidate = match.group(0).strip().strip('"').strip("'")
    return candidate.rstrip(").,;!?")


def _extract_video_id(url: str) -> str:
    """Extract Douyin video ID from URL path or query parameters."""
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    for key in ("modal_id", "item_ids", "group_id", "aweme_id"):
        values = query.get(key)
        if values:
            match = re.search(r"(\d{8,24})", values[0])
            if match:
                return match.group(1)

    for pattern in (r"/video/(\d{8,24})", r"/note/(\d{8,24})", r"/(\d{8,24})(?:/|$)"):
        match = re.search(pattern, parsed.path)
        if match:
            return match.group(1)

    fallback = re.search(r"(?<!\d)(\d{15,24})(?!\d)", url)
    if fallback:
        return fallback.group(1)

    raise ValueError(f"无法从链接中提取视频ID: {url}")


# ─── HTTP client with retry ──────────────────────────────────

async def _resolve_redirect(client: httpx.AsyncClient, share_url: str) -> str:
    """Resolve short link → final URL via 302 redirect."""
    resp = await client.get(share_url, follow_redirects=True)
    resp.raise_for_status()
    return str(resp.url)


async def _get_json_with_retry(client: httpx.AsyncClient, url: str, params: dict,
                                max_retries: int = 3) -> dict:
    """GET JSON with exponential backoff retry."""
    import asyncio
    retryable = {429, 500, 502, 503, 504}
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = await client.get(url, params=params)
            if resp.status_code in retryable:
                raise httpx.HTTPStatusError(
                    f"Retryable HTTP {resp.status_code}",
                    request=resp.request, response=resp,
                )
            resp.raise_for_status()
            if not resp.content:
                raise ValueError("API response was empty")
            return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            last_err = exc
            if attempt < max_retries:
                await asyncio.sleep(1.0 * (2 ** (attempt - 1)))
    raise ValueError("抖音API请求失败") from last_err


# ─── Share page fallback (window._ROUTER_DATA) ───────────────

def _extract_router_data(html: str) -> dict:
    """Extract window._ROUTER_DATA JSON from share page HTML."""
    marker = "window._ROUTER_DATA = "
    start = html.find(marker)
    if start < 0:
        return {}

    idx = start + len(marker)
    while idx < len(html) and html[idx].isspace():
        idx += 1
    if idx >= len(html) or html[idx] != "{":
        return {}

    depth = 0
    in_str = False
    escaped = False
    for cursor in range(idx, len(html)):
        ch = html[cursor]
        if in_str:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[idx:cursor + 1])
                except ValueError:
                    return {}
    return {}


def _item_info_from_router_data(router_data: dict) -> dict:
    """Extract item_list[0] from _ROUTER_DATA.loaderData."""
    loader = router_data.get("loaderData", {})
    if not isinstance(loader, dict):
        return {}
    for node in loader.values():
        if not isinstance(node, dict):
            continue
        vir = node.get("videoInfoRes", {})
        if isinstance(vir, dict):
            items = vir.get("item_list", [])
            if items and isinstance(items[0], dict):
                return items[0]
    return {}


# ─── WAF challenge solver ────────────────────────────────────

def _is_waf_page(html: str) -> bool:
    return "Please wait..." in html and "wci=" in html and "cs=" in html


def _decode_urlsafe_b64(value: str) -> bytes:
    normalized = value.replace("-", "+").replace("_", "/")
    normalized += "=" * (-len(normalized) % 4)
    return base64.b64decode(normalized)


def _solve_waf(html: str) -> tuple:
    """Solve WAF challenge, returns (cookie_name, cookie_value) or None."""
    match = re.search(r'wci="([^"]+)"\s*,\s*cs="([^"]+)"', html)
    if not match:
        return None
    cookie_name, challenge_blob = match.groups()
    try:
        data = json.loads(_decode_urlsafe_b64(challenge_blob).decode("utf-8"))
        prefix = _decode_urlsafe_b64(data["v"]["a"])
        expected = _decode_urlsafe_b64(data["v"]["c"]).hex()
    except (KeyError, ValueError, TypeError):
        return None

    solved = None
    for candidate in range(1_000_001):
        if sha256(prefix + str(candidate).encode()).hexdigest() == expected:
            solved = candidate
            break
    if solved is None:
        return None

    data["d"] = base64.b64encode(str(solved).encode()).decode()
    cookie_val = base64.b64encode(
        json.dumps(data, separators=(",", ":")).encode()
    ).decode()
    return cookie_name, cookie_val


# ─── Main parse function ─────────────────────────────────────

async def parse_douyin(url: str) -> dict:
    """
    Parse a Douyin video URL and return structured video info.
    No cookies, no login required.
    """
    share_url = _extract_first_url(url)

    async with httpx.AsyncClient(
        headers=DEFAULT_HEADERS, timeout=30, follow_redirects=True
    ) as client:
        # Step 1: Resolve short link
        resolved_url = await _resolve_redirect(client, share_url)
        video_id = _extract_video_id(resolved_url)
        logger.info("Douyin video_id: %s", video_id)

        # Step 2: Try public API (iesdouyin.com)
        item_info = await _fetch_via_api(client, video_id, resolved_url)

    # Step 3: Build response
    title = item_info.get("desc") or f"douyin_{video_id}"

    # Video URL: playwm → play = no watermark
    play_urls = (
        item_info.get("video", {})
        .get("play_addr", {})
        .get("url_list", [])
    )
    no_wm_url = play_urls[0].replace("playwm", "play") if play_urls else None

    # Thumbnail
    video_meta = item_info.get("video", {})
    cover_url = None
    for key in ("cover", "origin_cover", "dynamic_cover"):
        urls = video_meta.get(key, {}).get("url_list", [])
        if urls:
            cover_url = urls[0]
            break

    # Duration (milliseconds → seconds)
    duration_ms = video_meta.get("duration", 0)
    duration = duration_ms / 1000 if duration_ms else None

    # Author
    author = item_info.get("author", {}).get("nickname", "")

    # Statistics
    stats = item_info.get("statistics", {})

    # Music / audio
    music = item_info.get("music", {})
    audio_urls = music.get("play_url", {}).get("url_list", [])

    # Build quality options
    quality_options = [{
        "label": "最佳画质 - 无水印 (mp4)",
        "format_id": "best",
        "ext": "mp4",
        "resolution": "best",
        "filesize": None,
    }]

    if audio_urls:
        quality_options.append({
            "label": "仅音频 (mp3)",
            "format_id": "audio",
            "ext": "mp3",
            "resolution": "audio",
            "filesize": None,
        })

    return {
        "title": title,
        "thumbnail": cover_url,
        "duration": duration,
        "uploader": author,
        "view_count": stats.get("play_count") or stats.get("digg_count"),
        "description": (title[:200]) if title else "",
        "webpage_url": f"https://www.douyin.com/video/{video_id}",
        "extractor": "douyin",
        "formats": [],
        "quality_options": quality_options,
        "_no_wm_url": no_wm_url,
        "_audio_url": audio_urls[0] if audio_urls else None,
        "_video_id": video_id,
    }


async def _fetch_via_api(client: httpx.AsyncClient, video_id: str,
                          resolved_url: str) -> dict:
    """Try the public iesdouyin API, fallback to share page parsing."""
    try:
        data = await _get_json_with_retry(
            client, DOUYIN_API_URL, params={"item_ids": video_id}
        )
        status_code = data.get("status_code")
        if status_code not in (0, None):
            raise ValueError(f"API status_code={status_code}")
        items = data.get("item_list") or []
        if items:
            return items[0]
        raise ValueError("API returned empty item_list")
    except Exception as exc:
        logger.warning("Public API failed (%s), falling back to share page.", exc)

    # Fallback: parse the share page
    return await _fetch_from_share_page(client, video_id, resolved_url)


async def _fetch_from_share_page(client: httpx.AsyncClient, video_id: str,
                                   resolved_url: str) -> dict:
    """Parse the iesdouyin share page for video metadata."""
    parsed = urlparse(resolved_url)
    if parsed.netloc and "iesdouyin.com" in parsed.netloc:
        share_url = resolved_url
    else:
        share_url = f"https://www.iesdouyin.com/share/video/{video_id}/"

    resp = await client.get(share_url, headers=MOBILE_SHARE_HEADERS)
    resp.raise_for_status()
    html = resp.text

    # Handle WAF challenge
    if _is_waf_page(html):
        waf_result = _solve_waf(html)
        if waf_result:
            cookie_name, cookie_val = waf_result
            client.cookies.set(cookie_name, cookie_val,
                               domain="www.iesdouyin.com")
            resp = await client.get(share_url, headers=MOBILE_SHARE_HEADERS)
            resp.raise_for_status()
            html = resp.text

    router_data = _extract_router_data(html)
    if not router_data:
        raise ValueError("无法从抖音分享页提取视频数据")

    item_info = _item_info_from_router_data(router_data)
    if not item_info:
        raise ValueError("无法从分享页提取视频元数据")

    return item_info


# ─── Download helper ──────────────────────────────────────────

async def download_douyin_video(
    url: str, output_path: str, format_id: str = "best",
    progress_callback=None,
) -> str:
    """
    Download a Douyin video/audio. Returns saved file path.
    progress_callback(percent: int) is called during download.
    """
    info = await parse_douyin(url)

    if format_id == "audio" and info.get("_audio_url"):
        download_url = info["_audio_url"]
    else:
        download_url = info.get("_no_wm_url")
        if not download_url:
            raise ValueError("没有找到可下载的视频地址")

    async with httpx.AsyncClient(
        headers={**DEFAULT_HEADERS, "Referer": "https://www.douyin.com/"},
        timeout=120, follow_redirects=True,
    ) as client:
        async with client.stream("GET", download_url) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            downloaded = 0
            with open(output_path, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if progress_callback and total > 0:
                        progress_callback(int(downloaded / total * 100))

    return output_path
