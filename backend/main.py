import os
import re
import uuid
import json
import asyncio
import threading
import traceback
import httpx
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from pydantic import BaseModel

from yt_dlp import YoutubeDL
from douyin_parser import is_douyin_url, parse_douyin
from ai_routes import router as ai_router

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# Browsers to try for cookie extraction (order matters)
COOKIE_BROWSERS = ["chrome", "edge", "firefox"]

app = FastAPI(title="万能视频下载器 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)

DOWNLOAD_DIR = Path(__file__).parent / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

# In-memory task storage
tasks = {}


class ParseRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format_id: Optional[str] = None
    quality: Optional[str] = "best"


def _base_ydl_opts():
    """Common yt-dlp options with browser-like headers."""
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "http_headers": {
            "User-Agent": USER_AGENT,
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.douyin.com/",
        },
        "socket_timeout": 30,
    }


def _try_extract(url, extra_opts=None):
    """Try extracting video info, with fallback to browser cookies."""
    opts = _base_ydl_opts()
    if extra_opts:
        opts.update(extra_opts)

    # First attempt: no cookies
    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return ydl.sanitize_info(info)
    except Exception as first_err:
        first_msg = str(first_err)

    # Second attempt: try browser cookies
    for browser in COOKIE_BROWSERS:
        try:
            opts_with_cookie = {**opts, "cookiesfrombrowser": (browser,)}
            with YoutubeDL(opts_with_cookie) as ydl:
                info = ydl.extract_info(url, download=False)
                return ydl.sanitize_info(info)
        except Exception:
            continue

    # All attempts failed
    raise Exception(first_msg)


# ---------- Parse ----------

@app.post("/api/parse")
async def parse_video(req: ParseRequest):
    """Extract video metadata without downloading."""

    # ---- Douyin: use dedicated parser (no cookies needed) ----
    if is_douyin_url(req.url):
        try:
            return await parse_douyin(req.url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"抖音解析失败: {str(e)}")

    # ---- Other platforms: use yt-dlp ----
    try:
        info = _try_extract(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"解析失败: {str(e)}")

    formats = []
    for f in info.get("formats", []):
        fmt = {
            "format_id": f.get("format_id"),
            "ext": f.get("ext"),
            "resolution": f.get("resolution", "audio only"),
            "filesize": f.get("filesize") or f.get("filesize_approx"),
            "vcodec": f.get("vcodec"),
            "acodec": f.get("acodec"),
            "fps": f.get("fps"),
            "format_note": f.get("format_note", ""),
            "has_video": f.get("vcodec", "none") != "none",
            "has_audio": f.get("acodec", "none") != "none",
        }
        formats.append(fmt)

    # Build simplified quality options
    quality_options = _build_quality_options(formats)

    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader"),
        "view_count": info.get("view_count"),
        "description": info.get("description", "")[:200],
        "webpage_url": info.get("webpage_url"),
        "extractor": info.get("extractor"),
        "formats": formats,
        "quality_options": quality_options,
    }


def _build_quality_options(formats):
    """Build user-friendly quality options from raw formats."""
    options = []
    seen = set()

    # Video + Audio combined options
    video_formats = [f for f in formats if f["has_video"]]
    for f in video_formats:
        res = f.get("resolution", "")
        if res and res not in seen:
            seen.add(res)
            options.append({
                "label": f"{res} ({f.get('ext', 'mp4')})",
                "format_id": f["format_id"],
                "ext": f.get("ext", "mp4"),
                "resolution": res,
                "filesize": f.get("filesize"),
            })

    # Audio only option
    audio_formats = [f for f in formats if f["has_audio"] and not f["has_video"]]
    if audio_formats:
        best_audio = audio_formats[-1]
        options.append({
            "label": f"仅音频 ({best_audio.get('ext', 'mp3')})",
            "format_id": best_audio["format_id"],
            "ext": best_audio.get("ext", "mp3"),
            "resolution": "audio",
            "filesize": best_audio.get("filesize"),
        })

    # Best quality option at the beginning
    options.insert(0, {
        "label": "最佳画质 (自动)",
        "format_id": "best",
        "ext": "mp4",
        "resolution": "best",
        "filesize": None,
    })

    return options


# ---------- Download ----------

@app.post("/api/download")
async def start_download(req: DownloadRequest):
    """Start a download task."""
    task_id = str(uuid.uuid4())[:8]
    tasks[task_id] = {
        "status": "pending",
        "progress": 0,
        "filename": None,
        "filepath": None,
        "error": None,
        "title": None,
    }

    # Douyin: use dedicated downloader in async loop
    if is_douyin_url(req.url):
        asyncio.create_task(_run_douyin_download(task_id, req.url, req.format_id))
    else:
        thread = threading.Thread(
            target=_run_download,
            args=(task_id, req.url, req.format_id, req.quality),
            daemon=True,
        )
        thread.start()

    return {"task_id": task_id}


async def _run_douyin_download(task_id, url, format_id):
    """Download Douyin video using dedicated HTTP downloader (no cookies)."""
    try:
        tasks[task_id]["status"] = "downloading"
        tasks[task_id]["progress"] = 10

        # Parse to get title + download URLs
        info = await parse_douyin(url)
        title = info.get("title", "douyin_video")[:60]
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)
        tasks[task_id]["title"] = safe_title
        tasks[task_id]["progress"] = 20

        # Choose download URL based on format
        dl_format = format_id or "best"
        if dl_format == "audio" and info.get("_audio_url"):
            download_url = info["_audio_url"]
            ext = "mp3"
        else:
            download_url = info.get("_no_wm_url")
            if not download_url:
                raise ValueError("没有找到可下载的视频地址")
            ext = "mp4"

        output_path = str(DOWNLOAD_DIR / f"{task_id}_{safe_title}.{ext}")
        tasks[task_id]["progress"] = 30

        # Streaming download with progress
        from douyin_parser import DEFAULT_HEADERS as DY_HEADERS
        async with httpx.AsyncClient(follow_redirects=True, timeout=120, headers={
            **DY_HEADERS,
            "Referer": "https://www.douyin.com/",
        }) as client:
            async with client.stream("GET", download_url) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                with open(output_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=65536):
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            pct = 30 + int(downloaded / total * 70)
                            tasks[task_id]["progress"] = min(pct, 99)

        tasks[task_id]["filepath"] = output_path
        tasks[task_id]["filename"] = f"{safe_title}.{ext}"
        tasks[task_id]["status"] = "done"
        tasks[task_id]["progress"] = 100

    except Exception as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        traceback.print_exc()


def _progress_hook(task_id):
    def hook(d):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            if total > 0:
                tasks[task_id]["progress"] = round(downloaded / total * 100, 1)
            tasks[task_id]["status"] = "downloading"
        elif d["status"] == "finished":
            tasks[task_id]["progress"] = 100
            tasks[task_id]["status"] = "processing"
    return hook


def _run_download(task_id, url, format_id, quality):
    """Run yt-dlp download in a thread."""
    output_template = str(DOWNLOAD_DIR / f"{task_id}_%(title)s.%(ext)s")

    fmt = "best"
    if format_id and format_id != "best":
        fmt = f"{format_id}+bestaudio/best"
    elif quality == "best":
        fmt = "bestvideo+bestaudio/best"

    ydl_opts = _base_ydl_opts()
    ydl_opts.update({
        "format": fmt,
        "outtmpl": output_template,
        "progress_hooks": [_progress_hook(task_id)],
        "merge_output_format": "mp4",
    })

    # Try download, with cookie fallback
    info = None
    last_err = None
    for attempt_opts in [ydl_opts] + [{**ydl_opts, "cookiesfrombrowser": (b,)} for b in COOKIE_BROWSERS]:
        try:
            with YoutubeDL(attempt_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                tasks[task_id]["title"] = info.get("title", "video")
            break
        except Exception as e:
            last_err = e
            continue

    if info is None:
        raise last_err or Exception("下载失败")

    try:

        # Find the downloaded file
        for f in DOWNLOAD_DIR.iterdir():
            if f.name.startswith(task_id):
                tasks[task_id]["filepath"] = str(f)
                tasks[task_id]["filename"] = f.name.replace(f"{task_id}_", "")
                break

        tasks[task_id]["status"] = "done"
        tasks[task_id]["progress"] = 100
    except Exception as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        traceback.print_exc()


# ---------- Progress (SSE) ----------

@app.get("/api/progress/{task_id}")
async def get_progress(task_id: str):
    """SSE endpoint for real-time progress."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    async def event_stream():
        while True:
            task = tasks.get(task_id, {})
            data = json.dumps(task, ensure_ascii=False)
            yield f"data: {data}\n\n"

            if task.get("status") in ("done", "error"):
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------- File Download ----------

@app.get("/api/file/{task_id}")
async def download_file(task_id: str):
    """Download the completed file."""
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task["status"] != "done":
        raise HTTPException(status_code=400, detail="文件尚未准备好")

    filepath = task["filepath"]
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=filepath,
        filename=task["filename"],
        media_type="application/octet-stream",
    )


# ---------- Thumbnail Proxy ----------

@app.get("/api/thumbnail")
async def proxy_thumbnail(url: str = Query(...)):
    """Proxy thumbnail images to bypass referrer restrictions."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(url, headers={
                "User-Agent": USER_AGENT,
                "Referer": url,
            })
            return Response(
                content=resp.content,
                media_type=resp.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except Exception:
        raise HTTPException(status_code=502, detail="无法获取图片")


# ---------- Health & Diagnostics ----------

@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "万能视频下载器 API 运行中"}


@app.get("/api/test")
async def test_parse(url: str = Query(...)):
    """Diagnostic endpoint: test parsing a URL and return detailed results."""
    results = {"url": url, "steps": []}

    # Step 1: try without cookies
    opts = _base_ydl_opts()
    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            info = ydl.sanitize_info(info)
            results["steps"].append({"method": "no_cookies", "success": True, "title": info.get("title")})
            results["success"] = True
            return results
    except Exception as e:
        results["steps"].append({"method": "no_cookies", "success": False, "error": str(e)[:200]})

    # Step 2: try each browser
    for browser in COOKIE_BROWSERS:
        try:
            opts_b = {**_base_ydl_opts(), "cookiesfrombrowser": (browser,)}
            with YoutubeDL(opts_b) as ydl:
                info = ydl.extract_info(url, download=False)
                info = ydl.sanitize_info(info)
                results["steps"].append({"method": f"cookies_{browser}", "success": True, "title": info.get("title")})
                results["success"] = True
                return results
        except Exception as e:
            results["steps"].append({"method": f"cookies_{browser}", "success": False, "error": str(e)[:200]})

    results["success"] = False
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
